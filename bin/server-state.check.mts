// Self-check for the background state file and log (R109). Run: node bin/server-state.check.mts
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { acquireStartLock, formatStatus, formatStopped, formatUptime, isAlive, killTree, openLog, readLogFrom, readServerState, rotateLog, serverLogFile, serverStateFile, startLockFile, tildePath, workerTurnPids, writeServerState } from './server-state.mjs'

const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-server-state-'))
try {
  // A missing file (and a missing home) → null
  const home = path.join(root, 'home')
  assert.equal(readServerState(home), null)
  assert.equal(serverStateFile(home), path.join(home, 'server.json'))

  // Write → read round trip; a patch merges into what is there
  const first = {
    supervisorPid: 101, serverPid: 102, port: 3333, startedAt: '2026-10-20T08:00:00.000Z',
    log: serverLogFile(home), state: 'starting', restarts: [], lastError: null,
  }
  assert.deepEqual(writeServerState(home, first), first)
  assert.deepEqual(readServerState(home), first)
  writeServerState(home, { state: 'running' })
  assert.deepEqual(readServerState(home), { ...first, state: 'running' })
  writeServerState(home, { state: 'stopped', lastError: 'boom', serverPid: null })
  assert.deepEqual(readServerState(home), { ...first, state: 'stopped', lastError: 'boom', serverPid: null })
  // atomic: no tmp file left next to it
  assert.deepEqual(readdirSync(home), ['server.json'])

  // Garbage or a non-object → null, and a write over it starts fresh
  writeFileSync(serverStateFile(home), '{not json')
  assert.equal(readServerState(home), null)
  writeFileSync(serverStateFile(home), '[1,2]')
  assert.equal(readServerState(home), null)
  assert.deepEqual(writeServerState(home, { state: 'stopped' }), { state: 'stopped' })

  // isAlive: this process yes; an exited one, 0, negatives and non-numbers no
  assert.equal(isAlive(process.pid), true)
  const dead = spawnSync(process.execPath, ['-e', '0']).pid
  assert.equal(isAlive(dead), false)
  for (const pid of [0, -1, null, undefined, '123', 1.5]) assert.equal(isAlive(pid as number), false)

  // The log: appended to, read from this run's offset, rotated once over the limit
  const a = openLog(home)
  assert.equal(a.offset, 0)
  writeSync(a.fd, 'run one\n')
  closeSync(a.fd)
  const b = openLog(home)
  assert.equal(b.offset, 8)
  writeSync(b.fd, 'run two\n')
  closeSync(b.fd)
  assert.equal(readLogFrom(home, b.offset), 'run two\n')
  assert.equal(readLogFrom(home), 'run one\nrun two\n')
  assert.equal(readLogFrom(path.join(root, 'nowhere')), '')
  rotateLog(home, 100)
  assert.ok(existsSync(serverLogFile(home)), 'under the limit: stays')
  rotateLog(home, 10)
  assert.equal(existsSync(serverLogFile(home)), false, 'over the limit: moved')
  assert.ok(existsSync(`${serverLogFile(home)}.1`))
  rotateLog(path.join(root, 'nowhere')) // no log yet: nothing happens, no throw

  // The start lock: exclusive, a second claimer waits until the first releases, a dead holder's lock is taken over
  const lockHome = path.join(root, 'lock-home')
  const release = await acquireStartLock(lockHome)
  assert.equal(typeof release, 'function')
  assert.equal(readFileSync(startLockFile(lockHome), 'utf8').trim(), String(process.pid))
  const timedOut = await acquireStartLock(lockHome, { timeoutMs: 300, intervalMs: 50 })
  assert.match((timedOut as { error: string }).error, /still holds/)
  let waited = false
  const second = acquireStartLock(lockHome, { intervalMs: 20, onWait: () => { waited = true } })
  await new Promise((r) => setTimeout(r, 100))
  assert.equal(waited, true, 'the second claimer waits')
  ;(release as () => void)()
  const release2 = await second
  assert.equal(typeof release2, 'function', 'and gets it once the first releases')
  ;(release2 as () => void)()
  ;(release2 as () => void)() // twice is harmless
  assert.equal(existsSync(startLockFile(lockHome)), false)
  writeFileSync(startLockFile(lockHome), `${dead}\n`)
  const release3 = await acquireStartLock(lockHome, { timeoutMs: 1000 })
  assert.equal(typeof release3, 'function', 'a dead holder\'s lock is taken over')
  ;(release3 as () => void)()

  // formatStatus: running (address, since when, log with home as ~), foreground, not running, not running + lastError
  process.env.TZ = 'UTC'
  const running = { ...first, state: 'running', startedAt: '2026-10-20T14:02:00.000Z', log: '/Users/me/.vibedoc/logs/server.log' }
  const now = Date.parse('2026-10-20T17:14:30.000Z')
  assert.deepEqual(formatStatus(running, { mode: 'background', port: 3333, now, userHome: '/Users/me' }), [
    '● VibeDoc is running at http://localhost:3333',
    '  since 2026-10-20 14:02 (3 h 12 min)',
    '  log: ~/.vibedoc/logs/server.log',
  ])
  assert.deepEqual(formatStatus(null, { mode: 'foreground', port: 3333 }), [
    '● VibeDoc is running in the foreground at http://localhost:3333 (not started with `vibedoc start`)',
  ])
  const notRunning = ['○ VibeDoc is not running', '  Start it with: vibedoc start']
  assert.deepEqual(formatStatus(null, { mode: null, port: null }), notRunning)
  assert.deepEqual(formatStatus(running, { mode: null, port: null }), notRunning, 'a stale running file: not running')
  assert.deepEqual(formatStatus({ ...running, state: 'crashed', lastError: 'the app exited with code 1' }, { mode: null, port: null }), [
    '○ VibeDoc is not running', '  Last error: the app exited with code 1', '  Start it with: vibedoc start',
  ])
  assert.equal(formatUptime(30_000), 'under a minute')
  assert.equal(formatUptime(12 * 60_000), '12 min')
  assert.equal(formatUptime(3 * 3600_000), '3 h')
  assert.equal(formatUptime((2 * 24 + 4) * 3600_000 + 5 * 60_000), '2 d 4 h')
  assert.equal(tildePath('/Users/me', '/Users/me'), '~')
  assert.equal(tildePath('/Users/meow/x', '/Users/me'), '/Users/meow/x', 'only the home folder itself')

  // formatStopped: names the workers' epics once each, plural or not; nothing stopped → no lines
  assert.deepEqual(formatStopped({ workers: [{ id: 'a', epic: 'R108' }, { id: 'b', epic: 'R109' }], testRuns: 0, frontends: 0 }), [
    'Stopped 2 agent runs (R108, R109). They show as Interrupted with Resume next time.',
  ])
  assert.deepEqual(formatStopped({ workers: [{ id: 'a', epic: 'R108' }], testRuns: 1, frontends: 2 }), [
    'Stopped 1 agent run (R108). It shows as Interrupted with Resume next time.',
    'Stopped 1 test run.',
    'Stopped 2 dev servers VibeDoc started.',
  ])
  assert.deepEqual(formatStopped({ workers: [] }), [])
  assert.deepEqual(formatStopped(), [])

  // killTree: a parent and the detached grandchild it started are both gone; one that ignores SIGTERM gets SIGKILL
  const tree = spawn(process.execPath, ['-e', `
    const c = require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' })
    console.log(c.pid); setInterval(() => {}, 1000)`], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
  const grandchild = Number(await new Promise<string>((resolve) => tree.stdout.once('data', (d) => resolve(String(d)))))
  assert.ok(isAlive(tree.pid as number) && isAlive(grandchild))
  if (process.platform === 'win32') {
    assert.equal(await killTree(tree.pid as number), true)
  } else {
    assert.equal(await killTree(tree.pid as number, { graceMs: 2000 }), true)
    assert.equal(isAlive(grandchild), false, 'the grandchild is gone too')
    const stubborn = spawn(process.execPath, ['-e', `process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)`], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
    await new Promise((resolve) => stubborn.stdout.once('data', resolve))
    const t0 = Date.now()
    assert.equal(await killTree(stubborn.pid as number, { graceMs: 300 }), true, 'SIGKILL after the grace')
    assert.ok(Date.now() - t0 < 3000)
  }
  assert.equal(await killTree(dead), true, 'a dead pid: nothing to do')

  // workerTurnPids: live turns without endedAt from every project's .vibedoc-workers
  const wHome = path.join(root, 'w-home')
  const wDir = path.join(wHome, 'worktrees', 'proj-1', '.vibedoc-workers')
  mkdirSync(wDir, { recursive: true })
  writeFileSync(path.join(wDir, 'live.json'), JSON.stringify({ id: 'live', pid: process.pid, taskId: 'T001' }))
  writeFileSync(path.join(wDir, 'ended.json'), JSON.stringify({ id: 'ended', pid: process.pid, taskId: 'T002', endedAt: '2026-10-20T00:00:00Z' }))
  writeFileSync(path.join(wDir, 'dead.json'), JSON.stringify({ id: 'dead', pid: dead, taskId: 'T003' }))
  writeFileSync(path.join(wDir, 'bad.json'), '{nope')
  writeFileSync(path.join(wDir, 'live.ndjson'), '')
  assert.deepEqual(workerTurnPids(wHome), [{ id: 'live', taskId: 'T001', pid: process.pid }])
  assert.deepEqual(workerTurnPids(path.join(root, 'nowhere')), [])
} finally {
  rmSync(root, { recursive: true, force: true })
}
console.log('server-state.check: ok')
