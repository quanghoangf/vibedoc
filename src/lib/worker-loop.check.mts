// Self-check for worker-loop. Run: node src/lib/worker-loop.check.mts
import assert from 'node:assert/strict'
import { nextStep, orchestratorNote, pauseStep, resumableTurn, retryDelayMs } from './worker-loop.ts'

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

// T562: the orchestrator's note when a worker stops; none while it runs
const wk = { branch: 'vibedoc/R108', target: { kind: 'epic' as const, id: 'R108' } }
assert.equal(orchestratorNote(wk, 'wait-user', 'T557: the agent stopped before the task was done'), 'Worker vibedoc/R108 (R108) waits on you: T557: the agent stopped before the task was done.')
assert.equal(orchestratorNote(wk, 'ended', 'Epic finished'), 'Worker vibedoc/R108 (R108) ended: Epic finished.')
assert.equal(orchestratorNote(wk, 'stopped'), 'Worker vibedoc/R108 (R108) was stopped.')
assert.match(orchestratorNote(wk, 'failed', 'boom') ?? '', /failed: boom/)
assert.equal(orchestratorNote(wk, 'paused', 'Usage limit: tries again at x'), 'Worker vibedoc/R108 (R108) paused: Usage limit: tries again at x.')
for (const p of ['starting', 'running'] as const) assert.equal(orchestratorNote(wk, p), null)

// T567: over budget waits on the user with the reason, never claims, and an answer resumes that session
const over = { ...turn('over-turns'), note: 'Turn budget reached (60)' }
assert.deepEqual(nextStep(running, { kind: 'ready', taskId: 'T2' }, over), { kind: 'wait-user', reason: 'T1: Turn budget reached (60)' })
assert.deepEqual(nextStep(running, null, { ...turn('over-time'), note: 'Took longer than 30 min' }), { kind: 'wait-user', reason: 'T1: Took longer than 30 min' })
assert.equal(resumableTurn({ phase: 'wait-user', turns: [over] }), over)

// T567: a usage limit pauses: until the message's time, else 1, 5, 15, 30 min after the turn ended (n in a row)
assert.deepEqual([1, 2, 3, 4, 9].map(retryDelayMs), [1, 5, 15, 30, 30].map(m => m * 60_000))
const limit = (endedAt: string, retryAt?: string) => ({ ...turn('usage-limit'), endedAt, ...(retryAt && { retryAt }) })
assert.deepEqual(pauseStep({ turns: [turn('done'), limit('2026-10-20T10:00:00.000Z', '2026-10-20T15:00:00.000Z')] }), { taskId: 'T1', retryAt: '2026-10-20T15:00:00.000Z' })
assert.deepEqual(pauseStep({ turns: [limit('2026-10-20T10:00:00.000Z')] }), { taskId: 'T1', retryAt: '2026-10-20T10:01:00.000Z' })
assert.deepEqual(pauseStep({ turns: [limit('a'), limit('b'), limit('2026-10-20T10:00:00.000Z')] }), { taskId: 'T1', retryAt: '2026-10-20T10:15:00.000Z' })
// a finished task with a nearly spent window: pause before the next claim (no task to rerun)
assert.deepEqual(pauseStep({ turns: [turn('done')], retryAt: '2026-10-20T15:00:00.000Z' }), { taskId: null, retryAt: '2026-10-20T15:00:00.000Z' })
assert.equal(pauseStep({ turns: [turn('done')] }), null)
assert.equal(pauseStep({ turns: [] }), null)
// paused is not waiting on the user: no composer
assert.equal(resumableTurn({ phase: 'paused', turns: [limit('x')] }), null)

console.log('worker-loop: ok')
