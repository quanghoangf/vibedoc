import assert from 'node:assert/strict'
import { RUN_LINE_PREFIX, applyEvent, finishChecking, finishRun, isRunning, newRunState, parseRunLine, specInApp, startChecking } from './test-run-events.ts'

const line = (o: unknown) => `${RUN_LINE_PREFIX}${JSON.stringify(o)}`
assert.deepEqual(parseRunLine(line({ type: 'step-begin', index: 1, name: 'Open' })), { type: 'step-begin', index: 1, name: 'Open' })
assert.deepEqual(parseRunLine(line({ type: 'step-end', index: 1, name: 'Open', status: 'failed', error: 'boom' })), { type: 'step-end', index: 1, name: 'Open', status: 'failed', error: 'boom' })
assert.deepEqual(parseRunLine(`  [chromium] ${line({ type: 'end', status: 'passed' })}`), { type: 'end', status: 'passed' })
assert.equal(parseRunLine('  ✓  1 e2e/x.spec.ts:3:5 › T1 (1.2s)'), null)
assert.equal(parseRunLine(`${RUN_LINE_PREFIX}{not json`), null)
assert.equal(parseRunLine(line({ type: 'step-end', index: 1, name: 'x', status: 'weird' })), null)

const t0 = newRunState('T1', 'e2e/vibedoc/T1.spec.ts', '2026-10-05T00:00:00Z')
assert.equal(t0.state, 'starting')
assert.ok(isRunning(t0))
let s = applyEvent(t0, { type: 'step-begin', index: 1, name: 'Open' })
assert.equal(s.state, 'running')
s = applyEvent(s, { type: 'step-end', index: 1, name: 'Open', status: 'passed', error: null })
s = applyEvent(s, { type: 'step-begin', index: 2, name: 'Click' })
assert.deepEqual(s.steps.map(x => `${x.index}:${x.status}`), ['1:passed', '2:running'])

// Passed: reporter says passed and exit 0
const passed = finishRun(applyEvent(applyEvent(s, { type: 'step-end', index: 2, name: 'Click', status: 'passed', error: null }), { type: 'end', status: 'passed' }), { code: 0, cancelled: false, tail: 'out', now: 'n' })
assert.deepEqual([passed.state, passed.tail, passed.finishedAt], ['passed', null, 'n'])
assert.ok(!isRunning(passed))
// Failed: a step failed, exit 1, tail kept
const failed = finishRun(applyEvent(applyEvent(s, { type: 'step-end', index: 2, name: 'Click', status: 'failed', error: 'Expected: "A"' }), { type: 'end', status: 'failed' }), { code: 1, cancelled: false, tail: 'out', now: 'n' })
assert.deepEqual([failed.state, failed.tail, failed.steps[1].error], ['failed', 'out', 'Expected: "A"'])
// Cancelled mid-step: the running step is closed as failed, no tail
const cancelled = finishRun(s, { code: null, cancelled: true, tail: 'out', now: 'n' })
assert.deepEqual([cancelled.state, cancelled.steps[1].status, cancelled.tail], ['cancelled', 'failed', null])
// No verdict (No tests found, crash) → error with the tail
const crashed = finishRun(t0, { code: 1, cancelled: false, tail: 'Error: No tests found', now: 'n' })
assert.equal(crashed.state, 'error')
assert.match(crashed.error!, /code 1/)
assert.equal(crashed.tail, 'Error: No tests found')
// Setup error before spawn
assert.equal(finishRun(t0, { code: null, cancelled: false, tail: '', now: 'n', error: 'App did not start' }).error, 'App did not start')
// Playwright found no test (bad spec path): error, not a failure
assert.deepEqual(parseRunLine(line({ type: 'begin', tests: 0 })), { type: 'begin', tests: 0 })
const none = finishRun(applyEvent(applyEvent(t0, { type: 'begin', tests: 0 }), { type: 'end', status: 'failed' }), { code: 1, cancelled: false, tail: 'Error: No tests found.', now: 'n' })
assert.deepEqual([none.state, none.error], ['error', 'No tests found in e2e/vibedoc/T1.spec.ts'])
// Spec path → relative to the app dir
assert.equal(specInApp('e2e/vibedoc/T1.spec.ts', '.'), 'e2e/vibedoc/T1.spec.ts')
assert.equal(specInApp('apps/web/e2e/vibedoc/T1.spec.ts', 'apps/web'), 'e2e/vibedoc/T1.spec.ts')
assert.equal(specInApp('./apps/web/e2e/x.spec.ts', './apps/web/'), 'e2e/x.spec.ts')
assert.equal(specInApp('apps/api/e2e/x.spec.ts', 'apps/web'), null)
assert.equal(specInApp('apps/web', 'apps/web'), null)
assert.equal(specInApp('e2e/../../etc/x.spec.ts', '.'), null)
assert.equal(specInApp('/etc/x.spec.ts', '.'), null)
// R063: passed → checking → passed with the steps that passed on a blank page
{
  const checking = startChecking(passed)
  assert.deepEqual([checking.state, checking.finishedAt, isRunning(checking)], ['checking', null, true])
  const blank = [
    { type: 'step-end' as const, index: 1, name: 'Open', status: 'passed' as const, error: null },
    { type: 'step-end' as const, index: 2, name: 'Click', status: 'failed' as const, error: 'x' },
    { type: 'end' as const, status: 'failed' },
  ]
  const done = finishChecking(checking, { cancelled: false, blankEvents: blank, now: 'm' })
  assert.deepEqual([done.state, done.blankPassed, done.finishedAt, done.steps.length], ['passed', ['Open'], 'm', 2])
  assert.equal(finishChecking(checking, { cancelled: false, blankEvents: blank.slice(0, 1), now: 'm' }).blankPassed, null, 'no end event = not checked')
  assert.equal(finishChecking(checking, { cancelled: true, blankEvents: blank, now: 'm' }).state, 'cancelled')
  assert.equal(passed.blankPassed, null)
}
// R064: suite fields ride along; test-begin/test-end parse and leave a single-task state alone
{
  assert.deepEqual(parseRunLine(line({ type: 'step-begin', index: 1, name: 'Open', file: 'e2e/a.spec.ts', taskId: 'T138' })), { type: 'step-begin', index: 1, name: 'Open', file: 'e2e/a.spec.ts', taskId: 'T138' })
  assert.deepEqual(parseRunLine(line({ type: 'test-end', title: 'T138', status: 'passed', file: 'e2e/a.spec.ts', taskId: null })), { type: 'test-end', title: 'T138', status: 'passed', file: 'e2e/a.spec.ts', taskId: null })
  assert.deepEqual(parseRunLine(line({ type: 'test-begin', title: 'x' })), { type: 'test-begin', title: 'x' })
  const t = parseRunLine(line({ type: 'test-begin', title: 'x', file: 'e2e/a.spec.ts', taskId: 'T1' }))!
  assert.equal(applyEvent(t0, t), t0)
}
console.log('ok test-run-events')
