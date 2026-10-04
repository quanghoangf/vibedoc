/**
 * Frontend dev server lifecycle (T142): reuse the app when its URL already answers, else start it.
 * Process handling only, no fs. One server per project root, kept on globalThis like the SSE bus,
 * so two requests (or a hot reload) never spawn two servers. Only a server we started is ever killed.
 */

import { spawn, type ChildProcess } from 'child_process'

export type ServerState = 'stopped' | 'starting' | 'running'
export type FrontendServer = { url: string; startedByUs: boolean; stop: () => void }
export type ServerStatus = { state: ServerState; url: string; startedByUs: boolean; error?: string; output?: string }

type Entry = {
  child: ChildProcess
  url: string
  state: 'starting' | 'running'
  lines: string[]
  ready: Promise<FrontendServer>
}

const TAIL_LINES = 200
const PROBE_MS = 1500
const POLL_MS = 500

const g = globalThis as unknown as { vibedocFrontendServers?: Map<string, Entry>; vibedocFrontendExitHook?: boolean }
const servers = g.vibedocFrontendServers ?? (g.vibedocFrontendServers = new Map())
/** Last failure per root, so Settings can show it after a reload. Cleared on the next start. */
const failures = new Map<string, { error: string; output: string }>()

// VibeDoc shutting down: take the servers we started with it (sync, so it runs inside 'exit')
if (!g.vibedocFrontendExitHook) {
  g.vibedocFrontendExitHook = true
  process.once('exit', () => { for (const e of servers.values()) killGroup(e.child) })
}

/** `afterExit`: the shell just exited, sweep what it left in its group (the group id can't be reused while members live). */
function killGroup(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM', afterExit = false) {
  if (child.pid == null || (!afterExit && (child.exitCode !== null || child.signalCode !== null))) return
  try {
    // Dev servers spawn their own children: kill the whole group (detached = own group)
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-child.pid, signal)
  } catch {
    // Group already gone
  }
}

/** Any HTTP response counts as up (404/500/redirect included); a refused or hung connection doesn't. */
export async function probe(url: string, timeoutMs = PROBE_MS): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    await res.body?.cancel().catch(() => {})
    return true
  } catch {
    return false
  }
}

/** The child must not inherit VibeDoc's own port or Next internals: it would clash or boot in VibeDoc's mode. */
function childEnv(url: string): NodeJS.ProcessEnv {
  const env = {} as NodeJS.ProcessEnv
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'PORT' || k === 'NODE_ENV' || k.startsWith('__NEXT') || k.startsWith('NEXT_PRIVATE') || k === 'NEXT_RUNTIME') continue
    env[k] = v
  }
  const port = new URL(url).port
  if (port) env.PORT = port
  return env
}

function stopFor(root: string, entry: Entry): () => void {
  return () => {
    killGroup(entry.child)
    // A server that ignores SIGTERM gets SIGKILL
    setTimeout(() => killGroup(entry.child, 'SIGKILL'), 5000).unref()
    if (servers.get(root) === entry) servers.delete(root)
  }
}

export type EnsureOptions = {
  root: string
  /** Absolute app dir, where the start command runs */
  cwd: string
  url: string
  startCommand: string
  timeoutSec: number
  /** Called when a server we started exits or fails (the route turns it into an SSE event) */
  onChange?: () => void
}

/**
 * Makes sure the app answers at `url`: reuses a running server, else spawns `startCommand` in its own
 * process group and polls until it responds. Timeout or early exit rejects with the output tail.
 */
export async function ensureFrontend(opts: EnsureOptions): Promise<FrontendServer> {
  const { root, cwd, url, startCommand, timeoutSec, onChange } = opts
  const existing = servers.get(root)
  if (existing) return existing.ready
  if (await probe(url)) return { url, startedByUs: false, stop: () => {} }
  // Probing is async: another request may have started it meanwhile
  const raced = servers.get(root)
  if (raced) return raced.ready

  failures.delete(root)
  const child = spawn(startCommand, {
    cwd, shell: true, detached: process.platform !== 'win32', env: childEnv(url), stdio: ['ignore', 'pipe', 'pipe'],
  })
  const entry = { child, url, state: 'starting', lines: [] } as unknown as Entry
  let partial = ''
  const onData = (c: Buffer) => {
    const parts = (partial + c.toString('utf8')).split('\n')
    partial = parts.pop() ?? ''
    entry.lines.push(...parts)
    if (entry.lines.length > TAIL_LINES) entry.lines.splice(0, entry.lines.length - TAIL_LINES)
  }
  child.stdout?.on('data', onData)
  child.stderr?.on('data', onData)
  const tail = () => [...entry.lines, partial].join('\n').trimEnd()
  const stop = stopFor(root, entry)

  let exited: string | null = null
  child.on('error', e => { exited = e.message })
  child.on('exit', (code, signal) => {
    exited ??= signal ? `exited on ${signal}` : `exited with code ${code}`
    // Make sure nothing it spawned lingers
    killGroup(child, 'SIGKILL', true)
    if (servers.get(root) === entry) {
      servers.delete(root)
      if (entry.state === 'running') failures.set(root, { error: `The app ${exited}`, output: tail() })
      onChange?.()
    }
  })

  entry.ready = (async () => {
    const deadline = Date.now() + timeoutSec * 1000
    for (;;) {
      if (exited) break
      if (await probe(url)) {
        entry.state = 'running'
        return { url, startedByUs: true, stop }
      }
      if (Date.now() > deadline) break
      await new Promise(r => setTimeout(r, POLL_MS))
    }
    const error = exited
      ? `\`${startCommand}\` ${exited} before ${url} responded`
      : `${url} didn't respond within ${timeoutSec}s of \`${startCommand}\``
    stop()
    failures.set(root, { error, output: tail() })
    throw Object.assign(new Error(error), { output: tail() })
  })()
  servers.set(root, entry)
  return entry.ready
}

/** Stops the server VibeDoc started for this root. False when there is none (a reused server is never touched). */
export function stopFrontend(root: string): boolean {
  const entry = servers.get(root)
  if (!entry) return false
  stopFor(root, entry)()
  return true
}

/** What Settings shows: our own server's state, else whether something answers at the URL. */
export async function frontendServerStatus(root: string, url: string): Promise<ServerStatus> {
  const entry = servers.get(root)
  if (entry) return { state: entry.state, url: entry.url, startedByUs: true }
  const failure = failures.get(root)
  return { state: (await probe(url)) ? 'running' : 'stopped', url, startedByUs: false, ...failure }
}
