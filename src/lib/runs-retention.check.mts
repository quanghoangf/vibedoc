// Self-check: run retention. Run: node src/lib/runs-retention.check.mts
import assert from 'node:assert/strict'
import { DEFAULT_RUNS_KEEP, parseKeep, planPrune } from './runs-retention.ts'

const ids = ['20261004T101500Z', '20261004T095959Z', '20261231T235959Z', '20270101T000000Z']

// Ordering: the newest `keep` survive, whatever the input order
assert.deepEqual(planPrune(ids, 2).sort(), ['20261004T095959Z', '20261004T101500Z'])
assert.deepEqual(planPrune(ids, 3), ['20261004T095959Z'])
assert.deepEqual(planPrune(ids, 10), [])
assert.deepEqual(planPrune(ids, 4), [])

// Keep bounds: < 1 behaves as 1
assert.deepEqual(planPrune(ids, 0).sort(), ['20261004T095959Z', '20261004T101500Z', '20261231T235959Z'])
assert.deepEqual(planPrune(ids, -3), planPrune(ids, 1))
assert.deepEqual(planPrune(ids, NaN), planPrune(ids, 1))

// Empty list
assert.deepEqual(planPrune([], 5), [])
assert.deepEqual(planPrune([], 0, '20261004T101500Z'), [])

// The current run is never deleted, even when it is not the newest (clock skew), and counts as kept
assert.deepEqual(planPrune(ids, 1, '20261004T095959Z').sort(), ['20261004T101500Z', '20261231T235959Z', '20270101T000000Z'])
assert.deepEqual(planPrune(ids, 2, '20270101T000000Z').sort(), ['20261004T095959Z', '20261004T101500Z'])
assert.ok(!planPrune(ids, 0, '20261004T095959Z').includes('20261004T095959Z'))
// A current id not in the list doesn't take a slot
assert.deepEqual(planPrune(ids, 2, 'gone').sort(), ['20261004T095959Z', '20261004T101500Z'])

// parseKeep: unset → 5, garbage/0 → 1, numbers floor
assert.equal(DEFAULT_RUNS_KEEP, 5)
assert.equal(parseKeep(undefined), 5)
assert.equal(parseKeep(''), 5)
assert.equal(parseKeep(null), 5)
assert.equal(parseKeep('2'), 2)
assert.equal(parseKeep(3), 3)
assert.equal(parseKeep('2.9'), 2)
assert.equal(parseKeep('0'), 1)
assert.equal(parseKeep(-4), 1)
assert.equal(parseKeep('abc'), 1)
assert.equal(parseKeep({}), 1)

console.log('runs-retention: ok')
