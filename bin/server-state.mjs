// Background mode (R109): the supervisor's state file `<home>/server.json` and its log `<home>/logs/server.log`.
// The supervisor writes the state; `vibedoc start` / `status` / `stop` read it. `<home>/server.lock` lets one start
// run at a time. Plain JS: the bin ships unbuilt.
// Shape: { supervisorPid, serverPid, port, startedAt, log, state: "starting"|"running"|"crashed"|"stopped",
//          restarts: [], lastError: null }
// Check: node bin/server-state.check.mts
import { execFileSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Every process below `pid` (children, theirs, ...), from one `ps` snapshot; [] when ps fails. POSIX only. */
function descendants(pid) {
  let out
  try {
    out = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' })
  } catch {
    return []
  }
  const kids = new Map()
  for (const line of out.split('\n')) {
    const [p, pp] = line.trim().split(/\s+/).map(Number)
    if (!p) continue
    if (!kids.has(pp)) kids.set(pp, [])
    kids.get(pp).push(p)
  }
  const all = []
  for (const stack = [pid]; stack.length;) {
    for (const c of kids.get(stack.pop()) ?? []) {
      all.push(c)
      stack.push(c)
    }
  }
  return all
}

/**
 * Ends `pid` and everything it started (T571). POSIX: the tree is listed first (a child whose parent dies moves to
 * init), then each process and the group it leads (detached children lead their own) gets SIGTERM + SIGCONT (a
 * stopped process acts on it), and whatever still lives after `graceMs` SIGKILL. Windows: `taskkill /T /F`.
 * Resolves true once all of them are gone.
 */
export async function killTree(pid, { graceMs = 5000 } = {}) {
  if (!isAlive(pid)) return true
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
    for (const end = Date.now() + graceMs; isAlive(pid) && Date.now() < end;) await sleep(100)
    return !isAlive(pid)
  }
  const pids = [pid, ...descendants(pid)].filter((p) => p !== process.pid)
  const signal = (sig) => {
    for (const p of pids) {
      for (const target of [-p, p]) try { process.kill(target, sig) } catch {}
    }
  }
  signal('SIGTERM')
  signal('SIGCONT')
  for (const end = Date.now() + graceMs; pids.some(isAlive) && Date.now() < end;) await sleep(100)
  if (pids.some(isAlive)) {
    signal('SIGKILL')
    for (const end = Date.now() + 2000; pids.some(isAlive) && Date.now() < end;) await sleep(50)
  }
  return !pids.some(isAlive)
}

/**
 * Agent worker turns still running per their state files (`<home>/worktrees/<project>/.vibedoc-workers/<id>.json`,
 * R108 T556): `[{ id, taskId, pid }]` with no `endedAt` and a live pid. `vibedoc stop`'s sweep when the server
 * doesn't answer.
 */
export function workerTurnPids(home) {
  const found = []
  const root = path.join(home, 'worktrees')
  let projects = []
  try { projects = readdirSync(root) } catch {}
  for (const project of projects) {
    const dir = path.join(root, project, '.vibedoc-workers')
    let files = []
    try { files = readdirSync(dir).filter((f) => f.endsWith('.json')) } catch {}
    for (const f of files) {
      try {
        const s = JSON.parse(readFileSync(path.join(dir, f), 'utf8'))
        if (!s.endedAt && isAlive(s.pid)) found.push({ id: s.id ?? f.slice(0, -5), taskId: s.taskId ?? null, pid: s.pid })
      } catch {}
    }
  }
  return found
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * What `vibedoc stop` stopped besides VibeDoc itself: `{ workers: [{ id, epic }], testRuns, frontends }` (the
 * server's reply, or the sweep's) → lines; none = [].
 */
export function formatStopped({ workers = [], testRuns = 0, frontends = 0 } = {}) {
  const lines = []
  if (workers.length) {
    const names = [...new Set(workers.map((w) => w.epic || w.id))].join(', ')
    lines.push(`Stopped ${plural(workers.length, 'agent run')} (${names}). ${workers.length === 1 ? 'It shows' : 'They show'} as Interrupted with Resume next time.`)
  }
  if (testRuns) lines.push(`Stopped ${plural(testRuns, 'test run')}.`)
  if (frontends) lines.push(`Stopped ${plural(frontends, 'dev server')} VibeDoc started.`)
  return lines
}

export const startLockFile =(home) => path.join(home, 'server.lock')

/**
 * Claims the right to start VibeDoc: creates `<home>/server.lock` exclusively (O_EXCL) with this pid. While another
 * live process holds it, waits (polling) until it is released; a lock whose holder is dead is taken over. Resolves to
 * a `release()` function, or `{ error }` after `timeoutMs`. So two starts at the same moment never make two servers:
 * the second one goes on only once the first answers or failed, and then finds it running.
 */
export async function acquireStartLock(home, { timeoutMs = 90_000, intervalMs = 200, onWait } = {}) {
  mkdirSync(home, { recursive: true })
  const file = startLockFile(home)
  const end = Date.now() + timeoutMs
  let told = false
  for (;;) {
    try {
      const fd = openSync(file, 'wx')
      writeFileSync(fd, `${process.pid}\n`)
      closeSync(fd)
      let released = false
      return () => {
        if (released) return
        released = true
        try { if (readFileSync(file, 'utf8').trim() === String(process.pid)) unlinkSync(file) } catch {}
      }
    } catch (e) {
      if (e.code !== 'EEXIST') return { error: `couldn't create ${file}: ${e.message}` }
    }
    let holder = null
    try { holder = Number(readFileSync(file, 'utf8').trim()) } catch {}
    if (holder !== null && !Number.isNaN(holder) && !isAlive(holder)) {
      // stale (its holder died): take it over, unless someone else did in the meantime
      try { if (Number(readFileSync(file, 'utf8').trim()) === holder) unlinkSync(file) } catch {}
      continue
    }
    if (Date.now() > end) return { error: `another VibeDoc start (pid ${holder}) still holds ${file}` }
    if (!told) { told = true; onWait?.(holder) }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
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

const pad = (n) => String(n).padStart(2, '0')
/** A local date and time, `2026-10-20 14:02`. */
const localStamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

/** How long it has run: `3 h 12 min`, `2 d 4 h`, `12 min`, `under a minute`. */
export function formatUptime(ms) {
  const min = Math.floor(Math.max(0, ms) / 60_000)
  if (min < 1) return 'under a minute'
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
  if (d) return `${d} d${h ? ` ${h} h` : ''}`
  if (h) return `${h} h${m ? ` ${m} min` : ''}`
  return `${m} min`
}

/** The path with the user's home folder shown as `~`. */
export function tildePath(p, userHome = os.homedir()) {
  if (!p || !userHome) return p
  if (p === userHome) return '~'
  return p.startsWith(userHome + path.sep) ? `~${p.slice(userHome.length)}` : p
}

/**
 * `vibedoc status`'s lines. `state` = server.json (or null); `live` = what the live check found:
 * `{ mode: "background"|"foreground"|null, port, now?, userHome? }`. The caller reports background only when the
 * supervisor is alive and the app answers, so a stale file is "not running" (its lastError still shown).
 */
export function formatStatus(state, live) {
  const url = `http://localhost:${live.port}`
  if (live.mode === 'foreground') {
    return [`● VibeDoc is running in the foreground at ${url} (not started with \`vibedoc start\`)`]
  }
  if (live.mode === 'background') {
    const lines = [`● VibeDoc is running at ${url}`]
    const started = Date.parse(state?.startedAt ?? '')
    if (!Number.isNaN(started)) {
      lines.push(`  since ${localStamp(new Date(started))} (${formatUptime((live.now ?? Date.now()) - started)})`)
    }
    if (state?.log) lines.push(`  log: ${tildePath(state.log, live.userHome)}`)
    return lines
  }
  const lines = ['○ VibeDoc is not running']
  if (state?.lastError) lines.push(`  Last error: ${state.lastError}`)
  lines.push('  Start it with: vibedoc start')
  return lines
}
