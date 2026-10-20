// Background mode (R109): the small process `vibedoc start` leaves running. It starts `next start` the way the
// foreground `vibedoc` does, sends its output to the log (its own stdout/stderr already are the log), and keeps
// `<home>/server.json` up to date. Started detached by bin/vibedoc.mjs with the env it needs:
// VIBEDOC_HOME, VIBEDOC_PORT, VIBEDOC_ROOT, VIBEDOC_ADD_ROOT.
// Crash restart (T572): an exit it didn't ask for restarts the app on the same port after 1 s, 2 s, then 4 s; 5
// crashes within 60 s → `state: "crashed"` with the reason + log tail, and the supervisor exits. Agent workers are
// detached and outlive a crash on purpose (T556): the restarted app adopts them.
// Check (the pure part): node bin/supervisor.check.mts
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { appUrl, tailLines, waitUntilReady } from './address.mjs'
import { readLogFrom, readServerState, serverLogFile, writeServerState } from './server-state.mjs'

/** Crashes within this window count towards giving up. */
export const CRASH_WINDOW_MS = 60_000
/** This many crashes within the window → give up. */
export const MAX_CRASHES = 5
/** The wait before restart number 1, 2, 3+ (counted within the window). */
export const BACKOFF_MS = [1000, 2000, 4000]

/**
 * What to do after a crash. `restarts` = every crash so far (`[{at}]`, ISO times, the new one included); `now` in ms.
 * → `{ restartInMs }`, or `'give-up'` once MAX_CRASHES of them fall within CRASH_WINDOW_MS.
 */
export function nextAction(restarts, now) {
  const recent = restarts.filter((r) => now - Date.parse(r.at) < CRASH_WINDOW_MS).length
  if (recent >= MAX_CRASHES) return 'give-up'
  return { restartInMs: BACKOFF_MS[Math.min(Math.max(recent, 1), BACKOFF_MS.length) - 1] }
}

/** `code 1` / `signal SIGKILL`: how the app exited. */
export const exitText = (code, signal) => (signal ? `signal ${signal}` : `code ${code}`)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await supervise()

async function supervise() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const HOME = process.env.VIBEDOC_HOME
  const port = Number(process.env.VIBEDOC_PORT)
  const log = (line) => console.log(`[${new Date().toISOString()}] supervisor: ${line}`)

  if (!HOME || !Number.isInteger(port)) {
    log('VIBEDOC_HOME and VIBEDOC_PORT must be set (run `vibedoc start`)')
    process.exit(2)
  }

  writeServerState(HOME, {
    supervisorPid: process.pid,
    serverPid: null,
    port,
    startedAt: new Date().toISOString(),
    log: serverLogFile(HOME),
    state: 'starting',
    restarts: [],
    lastError: null,
  })
  log(`starting VibeDoc on ${appUrl(port)}`)

  const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next')
  let server = null
  let stopping = false
  let restartTimer = null

  function stop(state, lastError, code) {
    writeServerState(HOME, { state, lastError, serverPid: null })
    log(lastError ? `${state}: ${lastError}` : state)
    process.exit(code)
  }

  // `vibedoc stop` (T571): SIGTERM, or on Windows (no signals) `state: "stopped"` in server.json for this supervisor
  function stopApp(why) {
    if (stopping) return
    stopping = true
    clearTimeout(restartTimer)
    log(`${why}: stopping the app`)
    if (!server || server.exitCode !== null || server.signalCode !== null) stop('stopped', null, 0)
    server.once('exit', () => stop('stopped', null, 0))
    server.kill('SIGTERM')
  }
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stopApp(signal))
  const stopAsked = () => {
    const s = readServerState(HOME)
    return s?.state === 'stopped' && s.supervisorPid === process.pid
  }
  setInterval(() => { if (stopAsked()) stopApp('vibedoc stop') }, 1000).unref()

  function launch() {
    const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
      stdio: ['ignore', 'inherit', 'inherit'],
      cwd: projectRoot,
      windowsHide: true,
      env: { ...process.env, PORT: String(port) },
    })
    writeServerState(HOME, { serverPid: child.pid ?? null })
    return child
  }

  // An exit nobody asked for, once the app has been up: record it, then restart after the backoff or give up
  function onCrash(code, signal) {
    if (stopping) return
    if (stopAsked()) return stopApp('vibedoc stop')
    const restarts = [...(readServerState(HOME)?.restarts ?? []), { at: new Date().toISOString(), code, signal }]
    writeServerState(HOME, { restarts, serverPid: null, state: 'starting' })
    const action = nextAction(restarts, Date.now())
    if (action === 'give-up') {
      const tail = tailLines(readLogFrom(HOME), 10)
      const why = `the app exited with ${exitText(code, signal)}, ${MAX_CRASHES} times in ${CRASH_WINDOW_MS / 1000} s`
      stop('crashed', tail.length ? `${why}\n${tail.join('\n')}` : why, 1)
    }
    log(`the app exited with ${exitText(code, signal)}; restarting in ${action.restartInMs / 1000} s`)
    restartTimer = setTimeout(() => run(true), action.restartInMs)
  }

  async function run(restart) {
    if (stopping) return
    server = launch()
    const child = server
    child.on('error', (err) => {
      if (restart) log(`couldn't restart the app: ${err.message}`)
      else stop('stopped', `couldn't start the app: ${err.message}`, 1)
    })
    const ready = await waitUntilReady({ port, child })
    if (stopping) return
    if (ready === 'timeout') {
      if (!restart) {
        stopping = true
        child.kill('SIGTERM')
        stop('stopped', `the app didn't answer on ${appUrl(port)} within 60 seconds`, 1)
      }
      // a restart that hangs counts as a crash: end it, its exit lands in onCrash
      child.once('exit', onCrash)
      child.kill('SIGKILL')
      return
    }
    if (ready !== 'ready') {
      // the first start failing is `vibedoc start`'s to report; a restart failing is one more crash
      if (!restart) stop('stopped', `the app exited with code ${ready.exit} before it was ready`, 1)
      return onCrash(child.exitCode, child.signalCode)
    }
    writeServerState(HOME, { state: 'running' })
    log(`${restart ? 'running again' : 'running'} on ${appUrl(port)}`)
    child.once('exit', onCrash)
  }

  await run(false)
}
