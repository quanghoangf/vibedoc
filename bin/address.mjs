// The stable address (R080, R100): one VibeDoc serves every project, its port lives in <home>/port, so every run
// serves the same URL and an agent connected once stays connected. Plain JS: the bin ships unbuilt.
// Check: node bin/address.check.mts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

export const FIRST_PORT = 3333

/** `$VIBEDOC_HOME` or `~/.vibedoc`: the same folder as core's `hubFile()`. */
export const vibedocHome = () => process.env.VIBEDOC_HOME || path.join(os.homedir(), '.vibedoc')

export const portFile = (home) => path.join(home, 'port')

const validPort = (n) => Number.isInteger(n) && n >= 1 && n <= 65535

/** The saved port in the home folder, or null when there is none (or it isn't a port). */
export function readSavedPort(home) {
  try {
    const n = Number(readFileSync(portFile(home), 'utf8').trim())
    return validPort(n) ? n : null
  } catch {
    return null
  }
}

/** Saves the port; returns false when it can't (e.g. a read-only home), so the caller can say so. */
export function savePort(home, port) {
  try {
    mkdirSync(home, { recursive: true })
    writeFileSync(portFile(home), `${port}\n`)
    return true
  } catch {
    return false
  }
}

/** `--port N` → { port }, no flag → { port: null }, bad value → { error }. */
export function parsePortArg(args) {
  const i = args.indexOf('--port')
  if (i === -1) return { port: null }
  const raw = args[i + 1]
  const n = Number(raw)
  return validPort(n) && /^\d+$/.test(raw) ? { port: n } : { error: `--port needs a number from 1 to 65535 (got ${raw ?? 'nothing'})` }
}

/** Taken = something answers on 127.0.0.1, or we can't listen on it (covers a holder on another interface). */
export async function isPortTaken(port) {
  const answers = await new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
  if (answers) return true
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => server.close(() => resolve(false)))
    server.listen(port)
  })
}

/** The first free port from `from` upward. */
export async function firstFreePort(from = FIRST_PORT) {
  for (let port = from; port <= 65535; port++) if (!(await isPortTaken(port))) return port
  throw new Error(`No free port from ${from} upward`)
}

export const appUrl = (port) => `http://localhost:${port}`
/** The MCP endpoint; with a root, that project's (`?root=`), since one VibeDoc serves them all. */
export const mcpUrl = (port, root) => `${appUrl(port)}/api/mcp${root ? `?root=${encodeURIComponent(root)}` : ''}`
// a URL with `?` is quoted: unquoted, zsh reads it as a glob
export const connectCommand = (port, root) => `claude mcp add --transport http vibedoc ${root ? `'${mcpUrl(port, root)}'` : mcpUrl(port)}`

/** What the terminal prints once VibeDoc serves the project; no root = not in a repo, All projects. */
export function startupBanner({ root, port }) {
  if (!root) return [`   App:     ${appUrl(port)}`, '', '   Not in a repo: opening All projects. Run vibedoc inside a repo to add it.'].join('\n')
  return [
    `   Project: ${root}`,
    `   App:     ${appUrl(port)}`,
    `   MCP:     ${mcpUrl(port, root)}`,
    '',
    '   Connect Claude Code (once per project):',
    `   ${connectCommand(port, root)}`,
  ].join('\n')
}

/**
 * The root of the VibeDoc serving this port (its /api/projects lists the configured root first; `root: null` for a hub
 * with no projects yet, R100), or null for anything else.
 */
export async function probeVibedoc(port, timeoutMs = 1500) {
  try {
    const res = await fetch(`${appUrl(port)}/api/projects`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const projects = await res.json()
    if (!Array.isArray(projects)) return null
    if (!projects.length) return { root: null }
    return typeof projects[0]?.root === 'string' ? { root: projects[0].root } : null
  } catch {
    return null
  }
}

/**
 * Where to serve: `{ start: port, changedFrom? }`, `{ running: port }` when a VibeDoc hub already answers there (R100:
 * whatever its projects; the CLI adds this repo to it), or `{ error }` when a pinned `--port` is held by another program.
 */
export async function resolveAddress({ explicit, saved }) {
  const wanted = explicit ?? saved
  if (wanted == null) return { start: await firstFreePort() }
  if (!(await isPortTaken(wanted))) return { start: wanted }
  if (await probeVibedoc(wanted)) return { running: wanted }
  if (explicit != null) return { error: `Port ${explicit} is in use by another program. Stop it, or run vibedoc without --port.` }
  return { start: await firstFreePort(wanted + 1), changedFrom: wanted }
}

/** Adds `root` to the hub on `port` (POST /api/projects/add) → `{ id }`, or `{ error }` (3 s timeout). */
export async function addToHub(port, root, timeoutMs = 3000) {
  try {
    const res = await fetch(`${appUrl(port)}/api/projects/add`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-vibedoc-cli': '1' },
      body: JSON.stringify({ root }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = await res.json().catch(() => ({}))
    return res.ok && typeof body.id === 'string' ? { id: body.id } : { error: body.error ?? `HTTP ${res.status}` }
  } catch (e) {
    return { error: e.message }
  }
}

/** Told when the usual port was taken: the new MCP URL and how to reconnect Claude Code. */
export function addressChangedMessage({ oldPort, newPort, root }) {
  return [
    `   ⚠ Port ${oldPort} (this project's usual address) is in use by another program.`,
    `     VibeDoc now runs on ${newPort}, so the MCP URL changed to ${mcpUrl(newPort, root)}`,
    '     Reconnect Claude Code:',
    '     claude mcp remove vibedoc',
    `     ${connectCommand(newPort, root)}`,
    `     Other agents: point their MCP config at the new URL. VibeDoc keeps ${newPort} from now on.`,
  ].join('\n')
}

/**
 * Waits until the app answers /api/projects: 'ready', `{ exit: code }` when the child process ends first, or
 * 'timeout'. Polls every `intervalMs`.
 */
export function waitUntilReady({ port, child, timeoutMs = 60_000, intervalMs = 250 }) {
  return new Promise((resolve) => {
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      child.off('exit', onExit)
      resolve(result)
    }
    const onExit = (code) => finish({ exit: code ?? 1 })
    child.once('exit', onExit)
    if (child.exitCode !== null) onExit(child.exitCode)
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    const poll = async () => {
      if (done) return
      if (await probeVibedoc(port, Math.min(intervalMs * 4, 2000))) return finish('ready')
      setTimeout(poll, intervalMs)
    }
    poll()
  })
}

/** The last `n` non-empty lines of what a process wrote, for a start-failure message. */
export function tailLines(text, n = 15) {
  return text.split('\n').filter((l) => l.trim()).slice(-n)
}
