/**
 * src/lib/worker-loop.ts (R108 T554)
 * What a worker does next (ADR-007 decision 1). Pure: worker-runs.ts claims and spawns. Called twice per step:
 * first with no claim (may it claim? claiming has a side effect), then with the claim's result.
 */
import type { Worker, WorkerTurn } from './chats'
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
      reason: r === 'error' ? `${lastTurn.taskId}: the agent exited with an error`
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
