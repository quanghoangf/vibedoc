// Self-check for worker-loop. Run: node src/lib/worker-loop.check.mts
import assert from 'node:assert/strict'
import { nextStep, orchestratorNote, pauseStep, resumableTurn, retryDelayMs, taskClaim } from './worker-loop.ts'

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
assert.deepEqual(nextStep({ ...running, target: { kind: 'task', id: 'T1' } }, { kind: 'finished' }, turn('done')), { kind: 'ended', reason: 'Task finished' })

// T560: one task's claim: todo claims, the worker's own in-progress reruns, done/review ends, else waits on the user
const tk = (status: string, owner: string | null = null) => ({ id: 'T1', status, owner })
assert.equal(taskClaim(tk('todo'), 'worker-c-1'), 'claim')
assert.deepEqual(taskClaim(tk('in-progress', 'ai:worker-c-1'), 'worker-c-1'), { kind: 'ready', taskId: 'T1' })
for (const s of ['done', 'review', 'cancelled']) assert.deepEqual(taskClaim(tk(s), 'worker-c-1'), { kind: 'finished' })
const other = taskClaim(tk('in-progress', 'ai:claude'), 'worker-c-1')
assert.ok(other !== 'claim' && other.kind === 'waiting' && other.needsHuman && /T1 is in progress \(ai:claude\)/.test(other.waiting[0].reason))
assert.equal(nextStep(running, taskClaim(tk('blocked'), 'worker-c-1') as never, null).kind, 'wait-user')
assert.equal((taskClaim(null, 'worker-c-1') as { kind: string }).kind, 'waiting')
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

// T556: an interrupted task (its process died while VibeDoc was down) waits for Resume, with or without a session
const cut = { ...turn('interrupted'), note: 'Interrupted: the process ended without finishing' }
assert.deepEqual(nextStep(running, { kind: 'ready', taskId: 'T2' }, cut), { kind: 'wait-user', reason: 'T1: Interrupted: the process ended without finishing' })
assert.equal(resumableTurn({ phase: 'wait-user', turns: [cut] }), cut)
assert.equal(resumableTurn({ phase: 'wait-user', turns: [{ ...cut, sessionId: null }] })?.result, 'interrupted', 'reruns fresh')

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

// T568: the review gate. Off (no `gate`, or verify false) → a finished task claims the next one as before
const task = (id: string, result: string, sessionId = `s-${id}`) => ({ taskId: id, sessionId, startedAt: 'a', endedAt: 'b', result })
const rev = (id: string, result: string) => ({ ...task(id, result, `r-${id}`), kind: 'verify' as const })
const fix = (id: string, result: string) => ({ ...task(id, result), kind: 'fix' as const })
const on = (turns: object[]) => ({ verify: true, turns: turns as never[] })
const off = (turns: object[]) => ({ verify: false, turns: turns as never[] })
assert.deepEqual(nextStep(running, null, task('T1', 'done'), off([task('T1', 'done')])), { kind: 'claim' })
// done or review → verify it; blocked / in-progress still wait on the user, unreviewed
for (const r of ['done', 'review']) assert.deepEqual(nextStep(running, null, task('T1', r), on([task('T1', r)])), { kind: 'verify', taskId: 'T1' })
assert.equal(nextStep(running, null, task('T1', 'blocked'), on([task('T1', 'blocked')])).kind, 'wait-user')
assert.equal(nextStep(running, null, task('T1', 'cancelled'), on([task('T1', 'cancelled')])).kind, 'claim')
// clean → claim the next task
let h = [task('T1', 'done'), rev('T1', 'clean')]
assert.deepEqual(nextStep(running, null, h[1], on(h)), { kind: 'claim' })
assert.deepEqual(nextStep(running, { kind: 'ready', taskId: 'T2' }, h[1], on(h)), { kind: 'run-task', taskId: 'T2' })
// major → one fix turn in the task's own session (never the reviewer's)
h = [task('T1', 'done'), rev('T1', 'findings')]
assert.deepEqual(nextStep(running, null, h[1], on(h)), { kind: 'fix', taskId: 'T1', sessionId: 's-T1' })
// the fix done → verify again; still major → send back; never claims
h = [task('T1', 'done'), rev('T1', 'findings'), fix('T1', 'done')]
assert.deepEqual(nextStep(running, null, h[2], on(h)), { kind: 'verify', taskId: 'T1' })
h = [...h, rev('T1', 'findings')]
assert.deepEqual(nextStep(running, { kind: 'ready', taskId: 'T2' }, h[3], on(h)), { kind: 'send-back', taskId: 'T1' })
// fix → clean → claim
assert.deepEqual(nextStep(running, null, rev('T1', 'clean'), on([...h.slice(0, 3), rev('T1', 'clean')])), { kind: 'claim' })
// sent back → wait on the user with the note; the answer resumes the task's session (the fix turn), not the review
const sent = { ...rev('T1', 'sent-back'), note: 'sent back with 1 verification finding after one fix' }
h = [task('T1', 'done'), rev('T1', 'findings'), fix('T1', 'done'), sent]
assert.deepEqual(nextStep(running, { kind: 'ready', taskId: 'T2' }, sent, on(h)), { kind: 'wait-user', reason: 'T1: sent back with 1 verification finding after one fix' })
assert.equal(resumableTurn({ phase: 'wait-user', turns: h }), h[2])
// after the answer (a task turn) the count restarts: findings get one more fix
h = [...h, task('T1', 'done'), rev('T1', 'findings')]
assert.deepEqual(nextStep(running, null, h[5], on(h)), { kind: 'fix', taskId: 'T1', sessionId: 's-T1' })
// a fix cut by a usage limit doesn't count as the one fix
h = [task('T1', 'done'), rev('T1', 'findings'), fix('T1', 'usage-limit'), rev('T1', 'findings')]
assert.equal(nextStep(running, null, h[3], on(h)).kind, 'fix')
// a review that failed (error, no report) waits on the user and has no composer
const failedReview = { ...rev('T1', 'error'), note: 'the review ended without reporting findings' }
h = [task('T1', 'done'), failedReview]
assert.deepEqual(nextStep(running, null, failedReview, on(h)), { kind: 'wait-user', reason: 'T1: the review ended without reporting findings' })
assert.equal(resumableTurn({ phase: 'wait-user', turns: h }), null)
// T556 + T568: an interrupted review or fix waits for Resume like a task turn (the loop reruns the review, resumes the fix)
const cutReview = { ...rev('T1', 'interrupted'), note: 'Interrupted: the process ended without finishing' }
h = [task('T1', 'done'), cutReview]
assert.equal(nextStep(running, null, cutReview, on(h)).kind, 'wait-user')
assert.equal(resumableTurn({ phase: 'wait-user', turns: h }), cutReview)
h = [task('T1', 'done'), rev('T1', 'findings'), fix('T1', 'interrupted')]
assert.equal(nextStep(running, null, h[2], on(h)).kind, 'wait-user')
assert.equal(resumableTurn({ phase: 'wait-user', turns: h }), h[2])
// a limited review or fix says its kind, so the loop decides again instead of rerunning the task
assert.deepEqual(pauseStep({ turns: [task('T1', 'done'), { ...rev('T1', 'usage-limit'), retryAt: 'x' }] }), { taskId: 'T1', retryAt: 'x', kind: 'verify' })
assert.equal(pauseStep({ turns: [{ ...limit('2026-10-20T10:00:00.000Z', 'y') }] })?.kind, undefined)
// stopped still wins
assert.equal(nextStep({ phase: 'stopped' }, null, task('T1', 'done'), on([task('T1', 'done')])).kind, 'ended')

console.log('worker-loop: ok')
