/**
 * src/lib/worker-loop.ts (R108 T554)
 * What a worker does next (ADR-007 decision 1). Pure: worker-runs.ts claims and spawns. Called twice per step:
 * first with no claim (may it claim? claiming has a side effect), then with the claim's result.
 */
import type { Worker, WorkerPhase, WorkerTurn } from './chats'
import type { QueueResult } from './work-queue'

export type WorkerStep =
  | { kind: 'claim' }
  | { kind: 'run-task'; taskId: string }
  | { kind: 'wait-user'; reason: string }
  | { kind: 'ended'; reason: string }
  // T568: the review gate (ADR-007 decision 11)
  | { kind: 'verify'; taskId: string }
  | { kind: 'fix'; taskId: string; sessionId: string }
  | { kind: 'send-back'; taskId: string }

/**
 * A task that ended in review counts as finished for the worker (spike run A: done with checks left lands in review).
 * T568: so does a review with nothing critical or major (`clean`).
 */
const FINISHED = new Set(['done', 'review', 'cancelled', 'clean'])

/**
 * T568: after a task (or fix) turn that ended done or review → verify it; `findings` (critical or major) → one fix turn
 * in the task's session, else send it back. The fix count restarts after a send-back (the user's answer gets one more).
 * Null = no gate step. `turns` = the worker's turns, `last` included.
 */
function gateStep(last: WorkerTurn, turns: WorkerTurn[]): WorkerStep | null {
  if (last.kind !== 'verify') return last.result === 'done' || last.result === 'review' ? { kind: 'verify', taskId: last.taskId } : null
  if (last.result !== 'findings') return null
  let fixed = false
  let sessionId: string | null = null
  for (let i = turns.length - 1; i >= 0 && turns[i].taskId === last.taskId; i--) {
    const t = turns[i]
    if (t.kind === 'verify' && t.result === 'sent-back') break
    if (t.kind === 'fix' && t.result !== 'usage-limit') fixed = true
    if (t.kind !== 'verify' && t.sessionId && !sessionId) sessionId = t.sessionId
  }
  return !fixed && sessionId ? { kind: 'fix', taskId: last.taskId, sessionId } : { kind: 'send-back', taskId: last.taskId }
}

/** `worker.target` (T560): a task worker's loop claims that task only, so `finished` = the task is finished. */
export function nextStep(worker: Pick<Worker, 'phase'> & Partial<Pick<Worker, 'target'>>, claim: QueueResult | null, lastTurn: WorkerTurn | null, gate?: { verify: boolean; turns: WorkerTurn[] }): WorkerStep {
  if (worker.phase === 'stopped') return { kind: 'ended', reason: 'Stopped' }
  const g = lastTurn && gate?.verify ? gateStep(lastTurn, gate.turns) : null
  if (g) return g
  if (lastTurn && !FINISHED.has(lastTurn.result ?? '')) {
    const r = lastTurn.result
    return {
      kind: 'wait-user',
      reason: lastTurn.note ? `${lastTurn.taskId}: ${lastTurn.note}`
        : r === 'error' ? `${lastTurn.taskId}: the agent exited with an error`
        : r === 'in-progress' ? `${lastTurn.taskId}: the agent stopped before the task was done`
        : `${lastTurn.taskId} is ${r ?? 'still running'}`,
    }
  }
  if (!claim) return { kind: 'claim' }
  if (claim.kind === 'ready') return { kind: 'run-task', taskId: claim.taskId }
  if (claim.kind === 'finished') return { kind: 'ended', reason: worker.target?.kind === 'task' ? 'Task finished' : 'Epic finished' }
  const why = claim.waiting.map(w => w.reason).join('; ')
  return claim.needsHuman ? { kind: 'wait-user', reason: why } : { kind: 'ended', reason: `Nothing ready: ${why}` }
}

/**
 * T558: the turn an answer resumes (that task's session): the last one, when the worker waits because it left its task
 * unfinished. T556: an interrupted one without a session (it died before Claude Code printed one) reruns fresh; an
 * interrupted review reruns the review. T568: after a send-back, the task's own session (its last task or fix turn),
 * never the reviewer's.
 */
export function resumableTurn(worker: Pick<Worker, 'phase' | 'turns'>): WorkerTurn | null {
  const last = worker.turns[worker.turns.length - 1]
  if (last?.kind === 'verify') {
    if (worker.phase === 'wait-user' && last.result === 'interrupted') return last
    if (worker.phase !== 'wait-user' || last.result !== 'sent-back') return null
    return [...worker.turns].reverse().find(t => t.taskId === last.taskId && t.kind !== 'verify' && t.sessionId) ?? null
  }
  return worker.phase === 'wait-user' && (last?.sessionId || last?.result === 'interrupted') && nextStep({ phase: 'running' }, null, last).kind === 'wait-user' ? last : null
}

/**
 * T562: the note a worker's phase change leaves in the orchestrator chat, so its next turn knows (no turn is started).
 * Only the phases where a worker stops: null for the others. Interrupted (T556) is a wait-user whose reason says so.
 */
export function orchestratorNote(w: Pick<Worker, 'branch' | 'target'>, phase: WorkerPhase, reason?: string): string | null {
  const who = `Worker ${w.branch} (${w.target.id})`
  const why = reason ? `: ${reason}` : ''
  if (phase === 'wait-user') return `${who} waits on you${why}.`
  if (phase === 'ended') return `${who} ended${why}.`
  if (phase === 'stopped') return `${who} was stopped.`
  if (phase === 'failed') return `${who} failed${why}.`
  if (phase === 'paused') return `${who} paused${why}.`
  return null
}

/** T567: no reset time in the message: retry after 1, 5, 15, then every 30 min (`n` = usage-limit turns in a row). */
export function retryDelayMs(n: number): number {
  return [1, 5, 15, 30][Math.min(Math.max(n, 1), 4) - 1] * 60_000
}

/**
 * T567: whether the worker pauses before its next step, and until when. A usage-limit turn reruns its task after the
 * pause (fresh session, like every task: ADR-007 decision 1); `retryAt` on the worker alone (a finished task whose usage
 * window is nearly spent) pauses before the next claim. Read from the saved worker, so a restart resumes the same pause.
 * T568: `kind` = the limited turn was a verify or fix turn: after the pause the gate decides again from the turn before.
 */
/**
 * T560: the claim for one task (a task worker, or the task an epic worker was sent): todo → claim it; in-progress and
 * ours → run it again (a restart); finished → `finished`; anything else waits on the user. `Depends on` is not checked:
 * the user picked this task.
 */
export function taskClaim(task: { id: string; status: string; owner: string | null } | null, owner: string): QueueResult | 'claim' {
  if (!task) return { kind: 'waiting', waiting: [], needsHuman: true }
  if (task.status === 'todo') return 'claim'
  if (task.status === 'in-progress' && task.owner === `ai:${owner}`) return { kind: 'ready', taskId: task.id }
  if (FINISHED.has(task.status)) return { kind: 'finished' }
  const reason = task.status === 'in-progress' ? `${task.id} is in progress (${task.owner ?? 'claimed'})` : `${task.id} is ${task.status}`
  return { kind: 'waiting', waiting: [{ taskId: task.id, reason, why: task.status === 'in-progress' ? 'in-progress' : task.status === 'paused' ? 'paused' : 'blocked' }], needsHuman: true }
}

export function pauseStep(worker: Pick<Worker, 'turns' | 'retryAt'>): { taskId: string | null; retryAt: string; kind?: WorkerTurn['kind'] } | null {
  const last = worker.turns[worker.turns.length - 1]
  if (last?.result === 'usage-limit') {
    let n = 0
    for (let i = worker.turns.length - 1; i >= 0 && worker.turns[i].result === 'usage-limit'; i--) n++
    const retryAt = last.retryAt ?? new Date(Date.parse(last.endedAt ?? last.startedAt) + retryDelayMs(n)).toISOString()
    return { taskId: last.taskId, retryAt, ...(last.kind && { kind: last.kind }) }
  }
  return worker.retryAt ? { taskId: null, retryAt: worker.retryAt } : null
}
