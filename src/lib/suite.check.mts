import assert from 'node:assert/strict'
import { applySuiteEvent, collectSuite, finishSuite, isSuiteRunning, newSuiteState } from './suite.ts'

const task = (id: string, status: string, spec: string | null) => ({ id, title: id, status, manualTests: spec === undefined ? null : { spec } })
const { entries, skipped, outside } = collectSuite(
  [task('T10', 'done', 'e2e/b.spec.ts'), task('T9', 'done', 'e2e/a.spec.ts'), task('T11', 'todo', 'e2e/c.spec.ts'), task('T12', 'done', null), { id: 'T13', title: 'x', status: 'done', manualTests: null }, task('T14', 'done', 'apps/api/x.spec.ts')],
  (spec) => (spec.startsWith('apps/api') ? null : spec),
)
assert.deepEqual(entries.map(e => e.taskId), ['T9', 'T10'], 'done + spec only, numeric order')
assert.equal(skipped, 2)
assert.deepEqual(outside, [{ taskId: 'T14', spec: 'apps/api/x.spec.ts' }])

const s0 = newSuiteState(entries, skipped, 't0')
assert.ok(isSuiteRunning(s0))
const ev = (taskId: string, e: object) => ({ ...e, taskId, file: 'x' }) as never
let s = applySuiteEvent(s0, { type: 'begin', tests: 2 })
s = applySuiteEvent(s, ev('T9', { type: 'test-begin', title: 'a' }))
s = applySuiteEvent(s, ev('T9', { type: 'step-end', index: 1, name: 'A', status: 'passed', error: null }))
s = applySuiteEvent(s, ev('T10', { type: 'test-begin', title: 'b' }))
assert.deepEqual(s.tasks.map(t => t.status), ['running', 'running'])
s = applySuiteEvent(s, ev('T10', { type: 'step-end', index: 1, name: 'B1', status: 'passed', error: null }))
s = applySuiteEvent(s, ev('T10', { type: 'step-end', index: 2, name: 'B2', status: 'failed', error: 'Expected: "x"' }))
s = applySuiteEvent(s, ev('T9', { type: 'test-end', title: 'a', status: 'passed' }))
s = applySuiteEvent(s, ev('T10', { type: 'test-end', title: 'b', status: 'failed' }))
s = applySuiteEvent(s, ev('T99', { type: 'test-end', title: 'stray', status: 'failed' }))
s = applySuiteEvent(s, { type: 'end', status: 'failed' })
assert.deepEqual(s.tasks.map(t => [t.taskId, t.status, t.passed, t.steps]), [['T9', 'passed', 1, 1], ['T10', 'failed', 1, 2]])
assert.deepEqual(s.tasks[1].failedStep, { index: 2, name: 'B2', error: 'Expected: "x"' })
const failed = finishSuite(s, { code: 1, cancelled: false, tail: 'out', now: 't1' })
assert.deepEqual([failed.state, failed.endedAt, failed.tail], ['failed', 't1', 'out'])
assert.ok(!isSuiteRunning(failed))

// All passed, exit 0 → passed; cancel wins; no verdict → error
const ok = applySuiteEvent(applySuiteEvent(s0, ev('T9', { type: 'test-end', title: 'a', status: 'passed' })), { type: 'end', status: 'passed' })
assert.equal(finishSuite(ok, { code: 0, cancelled: false, tail: '', now: 'n' }).state, 'passed')
assert.equal(finishSuite(s, { code: null, cancelled: true, tail: '', now: 'n' }).state, 'cancelled')
assert.equal(finishSuite(s0, { code: 2, cancelled: false, tail: 'boom', now: 'n' }).state, 'error')
console.log('ok suite')
