// Self-check for the background state file and log (R109). Run: node bin/server-state.check.mts
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { acquireStartLock, isAlive, openLog, readLogFrom, readServerState, rotateLog, serverLogFile, serverStateFile, startLockFile, writeServerState } from './server-state.mjs'

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
} finally {
  rmSync(root, { recursive: true, force: true })
}
console.log('server-state.check: ok')
