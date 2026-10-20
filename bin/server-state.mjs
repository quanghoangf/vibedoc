// Background mode (R109): the supervisor's state file `<home>/server.json` and its log `<home>/logs/server.log`.
// The supervisor writes the state; `vibedoc start` / `status` / `stop` read it. Plain JS: the bin ships unbuilt.
// Shape: { supervisorPid, serverPid, port, startedAt, log, state: "starting"|"running"|"crashed"|"stopped",
//          restarts: [], lastError: null }
// Check: node bin/server-state.check.mts
import { closeSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const SERVER_STATES = ['starting', 'running', 'crashed', 'stopped']
/** The log moves to `server.log.1` at start once it is over this size. */
export const MAX_LOG_BYTES = 5 * 1024 * 1024

export const serverStateFile = (home) => path.join(home, 'server.json')
export const serverLogFile = (home) => path.join(home, 'logs', 'server.log')

/** The state file's content, or null when there is none (or it isn't a JSON object). */
export function readServerState(home) {
  try {
    const state = JSON.parse(readFileSync(serverStateFile(home), 'utf8'))
    return state && typeof state === 'object' && !Array.isArray(state) ? state : null
  } catch {
    return null
  }
}

/**
 * Merges `patch` into the state file and returns the new state. Atomic: written to a tmp file, then renamed over it,
 * so a reader never sees half a file.
 */
export function writeServerState(home, patch) {
  const next = { ...readServerState(home), ...patch }
  mkdirSync(home, { recursive: true })
  const file = serverStateFile(home)
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
  renameSync(tmp, file)
  return next
}

/** True while a process with this pid exists (EPERM = it exists, owned by someone else). */
export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/** Moves the log to `server.log.1` when it is over `maxBytes` (the older `.1` is replaced). */
export function rotateLog(home, maxBytes = MAX_LOG_BYTES) {
  const log = serverLogFile(home)
  try {
    if (statSync(log).size > maxBytes) renameSync(log, `${log}.1`)
  } catch {}
}

/** Opens the log for appending (folder made) → { fd, offset }: offset = its size now, where this run's output starts. */
export function openLog(home) {
  const log = serverLogFile(home)
  mkdirSync(path.dirname(log), { recursive: true })
  const fd = openSync(log, 'a')
  return { fd, offset: statSync(log).size }
}

/** The log's text from `offset` on (at most the last `maxBytes`), '' when it can't be read. */
export function readLogFrom(home, offset = 0, maxBytes = 16_000) {
  let fd
  try {
    fd = openSync(serverLogFile(home), 'r')
    const size = statSync(serverLogFile(home)).size
    const start = Math.max(offset, size - maxBytes)
    const buf = Buffer.alloc(Math.max(0, size - start))
    readSync(fd, buf, 0, buf.length, start)
    return buf.toString('utf8')
  } catch {
    return ''
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}
