// Self-check for worker-loop. Run: node src/lib/worker-loop.check.mts
import assert from 'node:assert/strict'
import { nextStep, resumableTurn } from './worker-loop.ts'

const running = { phase: 'running' as const }
const turn = (result: string | null) => ({ taskId: 'T1', sessionId: 's', startedAt: 'a', endedAt: 'b', result })

// first step, and after a finished task (review counts): may claim
assert.deepEqual(nextStep(running, null, null), { kind: 'claim' })
for (const r of ['done', 'review', 'cancelled']) assert.deepEqual(nextStep(running, null, turn(r)), { kind: 'claim' })

// a task left in-progress, blocked or an error: wait on the user, never claim the next one
assert.equal(nextStep(running, null, turn('in-progress')).kind, 'wait-user')
assert.match((nextStep(running, null, turn('error')) as { reason: string }).reason, /error/)
assert.equal(nextStep(running, null, turn('blocked')).kind, 'wait-user')
assert.equal(nextStep(running, { kind: 'ready', taskId: 'T2' }, turn('in-progress')).kind, 'wait-user')

// stopped wins over everything
assert.equal(nextStep({ phase: 'stopped' }, { kind: 'ready', taskId: 'T2' }, turn('done')).kind, 'ended')

// the claim's result
assert.deepEqual(nextStep(running, { kind: 'ready', taskId: 'T2' }, turn('done')), { kind: 'run-task', taskId: 'T2' })
assert.deepEqual(nextStep(running, { kind: 'finished' }, null), { kind: 'ended', reason: 'Epic finished' })
const w = { taskId: 'T3', reason: 'T3 is blocked', why: 'blocked' as const }
assert.deepEqual(nextStep(running, { kind: 'waiting', waiting: [w], needsHuman: true }, null), { kind: 'wait-user', reason: 'T3 is blocked' })
assert.equal(nextStep(running, { kind: 'waiting', waiting: [w], needsHuman: false }, null).kind, 'ended')

// T558: an answer resumes the waiting task's session, only while the worker waits on that task
const asked = turn('in-progress')
assert.equal(resumableTurn({ phase: 'wait-user', turns: [turn('done'), asked] }), asked)
assert.equal(resumableTurn({ phase: 'running', turns: [asked] }), null)
assert.equal(resumableTurn({ phase: 'wait-user', turns: [turn('done')] }), null, 'waiting on the queue (a blocked task), not on a turn')
assert.equal(resumableTurn({ phase: 'wait-user', turns: [{ ...asked, sessionId: null }] }), null, 'no session to resume')
assert.equal(resumableTurn({ phase: 'wait-user', turns: [] }), null)

console.log('worker-loop: ok')
