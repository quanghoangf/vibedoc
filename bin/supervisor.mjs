// Background mode (R109): the small process `vibedoc start` leaves running. It starts `next start` the way the
// foreground `vibedoc` does, sends its output to the log (its own stdout/stderr already are the log), and keeps
// `<home>/server.json` up to date. Started detached by bin/vibedoc.mjs with the env it needs:
// VIBEDOC_HOME, VIBEDOC_PORT, VIBEDOC_ROOT, VIBEDOC_ADD_ROOT. Crash restart is T572's.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { appUrl, waitUntilReady } from './address.mjs'
import { readServerState, serverLogFile, writeServerState } from './server-state.mjs'

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
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  stdio: ['ignore', 'inherit', 'inherit'],
  cwd: projectRoot,
  windowsHide: true,
  env: { ...process.env, PORT: String(port) },
})
writeServerState(HOME, { serverPid: server.pid ?? null })

let stopping = false
function stop(state, lastError, code) {
  writeServerState(HOME, { state, lastError, serverPid: null })
  log(lastError ? `${state}: ${lastError}` : state)
  process.exit(code)
}

server.on('error', (err) => stop('stopped', `couldn't start the app: ${err.message}`, 1))

// `vibedoc stop` (T571): SIGTERM, or on Windows (no signals) `state: "stopped"` in server.json for this supervisor
function stopApp(why) {
  if (stopping) return
  stopping = true
  log(`${why}: stopping the app`)
  if (server.exitCode !== null || server.signalCode !== null) stop('stopped', null, 0)
  server.once('exit', () => stop('stopped', null, 0))
  server.kill('SIGTERM')
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stopApp(signal))
setInterval(() => {
  const s = readServerState(HOME)
  if (s?.state === 'stopped' && s.supervisorPid === process.pid) stopApp('vibedoc stop')
}, 1000).unref()

const ready = await waitUntilReady({ port, child: server })
if (ready === 'timeout') {
  stopping = true
  server.kill('SIGTERM')
  stop('stopped', `the app didn't answer on ${appUrl(port)} within 60 seconds`, 1)
} else if (ready !== 'ready') {
  if (!stopping) stop('stopped', `the app exited with code ${ready.exit} before it was ready`, 1)
} else {
  writeServerState(HOME, { state: 'running' })
  log(`running on ${appUrl(port)}`)
  server.on('exit', (code, signal) => {
    if (stopping) return
    // no restart yet (T572): record the crash and end, so `status` tells the truth
    stop('crashed', `the app exited with ${signal ? `signal ${signal}` : `code ${code}`}`, 1)
  })
}
