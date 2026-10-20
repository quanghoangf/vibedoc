// The VibeDoc the desktop app uses (R111 T578): the hub that already answers on the home's port, else one this app
// starts as its own child (`bin/vibedoc.mjs --no-open`, the CLI's foreground start, run with Electron's Node) and
// stops on quit. A VibeDoc the app didn't start is never stopped. Its output: <home>/logs/desktop-server.log
import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import path from 'node:path'
import { binDir, fromBin } from './bin-path.mjs'

const { FIRST_PORT, appUrl, probeAddress, probeVibedoc, readSavedPort, tailLines } = await fromBin('address.mjs')
const { killTree } = await fromBin('server-state.mjs')
const bin = path.join(binDir, 'vibedoc.mjs')
export const desktopLogFile = (home) => path.join(home, 'logs', 'desktop-server.log')
/** The CLI prints this once the app answers (bin/vibedoc.mjs), after it saved the port. */
const READY = /✓ VibeDoc is (ready|already running)/

const hubPort = (home) => readSavedPort(home) ?? FIRST_PORT

/**
 * `{ url, owned: false, version, startedBy }` when a VibeDoc answers already (any version, either install: R112 T584),
 * `{ url, owned: true, child }` once the one this started answers, or `{ error, log: [last lines] }` when it couldn't
 * start, or another program holds the address (never a second VibeDoc on another port). `onStarting` runs before a
 * spawn (the starting screen).
 */
export async function ensureServer({ home, onStarting = () => {}, timeoutMs = 90_000 }) {
  const port = hubPort(home)
  const found = await probeAddress(port)
  if (found.kind === 'vibedoc') return { url: appUrl(port), owned: false, version: found.version, startedBy: found.startedBy }
  if (found.kind === 'other') return { error: `${appUrl(port)} is in use by another program, so VibeDoc can't start there. Stop that program, or change the port VibeDoc uses (${path.join(home, 'port')}).`, log: [] }
  onStarting()
  let log
  try {
    mkdirSync(path.dirname(desktopLogFile(home)), { recursive: true })
    log = createWriteStream(desktopLogFile(home), { flags: 'a' })
  } catch (e) {
    return { error: `couldn't write ${desktopLogFile(home)}: ${e.message}`, log: [] }
  }
  log.write(`\n── ${new Date().toISOString()} desktop app starts VibeDoc ──\n`)
  // cwd = the VibeDoc home: not a repo, so the hub starts with no project to add (the user picks one in the app)
  // --port pins the address: taken meanwhile → the CLI refuses (shown), never moves to another port
  const child = spawn(process.execPath, [bin, '--no-open', '--port', String(port)], {
    cwd: home,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', VIBEDOC_HOME: home, VIBEDOC_NO_OPEN: '1', VIBEDOC_STARTED_BY: 'desktop' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let out = ''
  const collect = (chunk) => {
    log.write(chunk)
    out = (out + chunk).slice(-16_000)
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timeout: true }), timeoutMs)
    const onData = () => READY.test(out) && finish({ ready: true })
    const finish = (r) => {
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.off('exit', onExit)
      child.off('error', onError)
      resolve(r)
    }
    const onExit = (code) => finish({ exit: code ?? 1 })
    const onError = (e) => finish({ error: e.message })
    child.stdout.on('data', onData)
    child.once('exit', onExit)
    child.once('error', onError)
  })
  const url = appUrl(hubPort(home))
  // "already running": another VibeDoc took the port meanwhile; it isn't ours (the CLI exits once it says so)
  if ((result.ready && /already running/.test(out)) || (result.exit === 0 && (await probeVibedoc(port)))) {
    const other = await probeAddress(port)
    return { url, owned: false, version: other.version ?? null, startedBy: other.startedBy ?? null }
  }
  if (result.ready) {
    child.once('exit', () => log.end())
    return { url, owned: true, child }
  }
  if (result.timeout) await killTree(child.pid)
  log.end()
  const reason = out.match(/✗ VibeDoc could not start: (.*)/)?.[1] ?? out.match(/✗ (.*)/)?.[1]
    ?? (result.timeout ? `VibeDoc didn't answer within ${timeoutMs / 1000} seconds` : result.error ?? `VibeDoc exited with code ${result.exit}`)
  return { error: reason.trim(), log: tailLines(out) }
}

/** Stops a VibeDoc this app started and everything under it (SIGTERM, then SIGKILL after 5 s; taskkill on Windows). */
export const stopServer = (child) => killTree(child.pid, { graceMs: 5000 })
