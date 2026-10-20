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

/** A task that ended in review counts as finished for the worker (spike run A: done with checks left lands in review). */
const FINISHED = new Set(['done', 'review', 'cancelled'])

export function nextStep(worker: Pick<Worker, 'phase'>, claim: QueueResult | null, lastTurn: WorkerTurn | null): WorkerStep {
  if (worker.phase === 'stopped') return { kind: 'ended', reason: 'Stopped' }
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
  if (claim.kind === 'finished') return { kind: 'ended', reason: 'Epic finished' }
  const why = claim.waiting.map(w => w.reason).join('; ')
  return claim.needsHuman ? { kind: 'wait-user', reason: why } : { kind: 'ended', reason: `Nothing ready: ${why}` }
}

/** T558: the turn an answer resumes (that task's session): the last one, when the worker waits because it left its task unfinished. */
export function resumableTurn(worker: Pick<Worker, 'phase' | 'turns'>): WorkerTurn | null {
  const last = worker.turns[worker.turns.length - 1]
  return worker.phase === 'wait-user' && last?.sessionId && nextStep({ phase: 'running' }, null, last).kind === 'wait-user' ? last : null
}

/**
 * T562: the note a worker's phase change leaves in the orchestrator chat, so its next turn knows (no turn is started).
 * Only the phases where a worker stops: null for the others. "Interrupted" is not a server phase (a page reload infers it).
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
 */
export function pauseStep(worker: Pick<Worker, 'turns' | 'retryAt'>): { taskId: string | null; retryAt: string } | null {
  const last = worker.turns[worker.turns.length - 1]
  if (last?.result === 'usage-limit') {
    let n = 0
    for (let i = worker.turns.length - 1; i >= 0 && worker.turns[i].result === 'usage-limit'; i--) n++
    const retryAt = last.retryAt ?? new Date(Date.parse(last.endedAt ?? last.startedAt) + retryDelayMs(n)).toISOString()
    return { taskId: last.taskId, retryAt }
  }
  return worker.retryAt ? { taskId: null, retryAt: worker.retryAt } : null
}
