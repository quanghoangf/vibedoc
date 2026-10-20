// Self-check for the supervisor's crash restart rule (R109 T572). Run: node bin/supervisor.check.mts
// Importing the module runs nothing: the supervisor starts only when it is the entry script.
import assert from 'node:assert/strict'
import { BACKOFF_MS, CRASH_WINDOW_MS, MAX_CRASHES, exitText, nextAction } from './supervisor.mjs'

const t0 = Date.parse('2026-10-20T10:00:00.000Z')
const at = (ms: number) => ({ at: new Date(t0 + ms).toISOString(), code: 1, signal: null })
/** `n` crashes `gapMs` apart, the last one at t0 + (n - 1) * gapMs. */
const crashes = (n: number, gapMs: number) => Array.from({ length: n }, (_, i) => at(i * gapMs))
const after = (list: { at: string }[]) => Date.parse(list[list.length - 1].at)

assert.deepEqual([MAX_CRASHES, CRASH_WINDOW_MS, BACKOFF_MS], [5, 60_000, [1000, 2000, 4000]])

// The backoff: 1 s, 2 s, then 4 s (and 4 s stays the ceiling)
for (const [n, wait] of [[1, 1000], [2, 2000], [3, 4000], [4, 4000]] as const) {
  const list = crashes(n, 3000)
  assert.deepEqual(nextAction(list, after(list)), { restartInMs: wait }, `${n} crash(es)`)
}

// 4 crashes within 60 s: still restarting
assert.notEqual(nextAction(crashes(4, 1000), after(crashes(4, 1000))), 'give-up')

// 5 crashes within 60 s: give up (also with older crashes before them)
assert.equal(nextAction(crashes(5, 1000), after(crashes(5, 1000))), 'give-up')
assert.equal(nextAction(crashes(5, 14_000), after(crashes(5, 14_000))), 'give-up', '56 s from first to fifth')
assert.equal(nextAction([at(-600_000), ...crashes(5, 1000)], t0 + 4000), 'give-up')

// 5 crashes spread over 2 minutes: still restarting, backoff from the crashes within the window
const spread = crashes(5, 30_000) // 0, 30, 60, 90, 120 s → 60 s before the last: 90 and 120 (60 is exactly out)
assert.deepEqual(nextAction(spread, after(spread)), { restartInMs: 2000 })
// more crashes over a long time never give up while each window holds fewer than 5
const slow = crashes(20, 20_000)
assert.notEqual(nextAction(slow, after(slow)), 'give-up')

// Nothing recorded (shouldn't happen, the new crash is in the list): restart after the shortest wait
assert.deepEqual(nextAction([], t0), { restartInMs: 1000 })

assert.equal(exitText(1, null), 'code 1')
assert.equal(exitText(null, 'SIGKILL'), 'signal SIGKILL')

console.log('supervisor.check: ok')
