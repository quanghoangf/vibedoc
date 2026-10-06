// Pure next-task picker for an epic's work queue (no fs). Self-check: node src/lib/work-queue.check.mts
import type { RoadmapItem, Task } from './core'

/**
 * `reviewHold`: a task in review that must stop its dependents (its last run failed, or the auto-fix limit sent it
 * to a human). Other review tasks only wait for someone to click through their checks, so dependents go on.
 */
export type QueueTask = Pick<Task, 'id' | 'status' | 'dependsOn'> & { reviewHold?: boolean }
/** Why a task can't be claimed: `reason` is the English line, `why` / `deps` the data a UI words itself (R078). */
export type Waiting = {
  taskId: string
  reason: string
  why: 'no-file' | 'in-progress' | 'blocked' | 'paused' | 'review-hold' | 'review' | 'deps'
  deps?: string[]
}
export type QueueResult =
  | { kind: 'ready'; taskId: string }
  | { kind: 'finished' }
  // needsHuman: no remaining task can move without someone unblocking or creating a task
  | { kind: 'waiting'; waiting: Waiting[]; needsHuman: boolean }

/** Every `T\d+` in a free-text "Depends on" line: "T008, T009 (x)" → ["T008","T009"]. */
export function depIds(dependsOn: string): string[] {
  return [...new Set((dependsOn.match(/\bT\d+\b/gi) ?? []).map(d => d.toUpperCase()))]
}

const settled = (s: Task['status']) => s === 'done' || s === 'cancelled'
/** A dependency is met when done / cancelled, or in review only for its checks (not a failure). */
const met = (t: QueueTask) => settled(t.status) || (t.status === 'review' && !t.reviewHold)

export function pickNextTask(epic: RoadmapItem, tasks: QueueTask[]): QueueResult {
  const byId = new Map(tasks.map(t => [t.id, t]))
  const linked = epic.tasks.map(id => byId.get(id)).filter((t): t is QueueTask => !!t)
  const unmet = (t: QueueTask) => depIds(t.dependsOn).filter(d => {
    const dep = byId.get(d)
    return !dep || !met(dep)
  })

  for (const t of linked) {
    if (t.status === 'todo' && !unmet(t).length) return { kind: 'ready', taskId: t.id }
  }
  if (linked.every(t => settled(t.status))) return { kind: 'finished' }

  // Can this task still move without a human? in-progress/settled yes; blocked/paused/review/missing no
  // (review waits for someone to approve or send it back, R043; a checks-only review still meets its dependents);
  // todo only if it's in this epic (the queue never hands out outside tasks) and every unmet dep can.
  // Cycles count as stuck.
  const inEpic = new Set(epic.tasks)
  const memo = new Map<string, boolean>()
  const canMove = (id: string): boolean => {
    if (memo.has(id)) return memo.get(id) ?? false
    memo.set(id, false)
    const t = byId.get(id)
    const ok = !!t && t.status !== 'blocked' && t.status !== 'paused' && t.status !== 'review' && (t.status !== 'todo' || (inEpic.has(id) && unmet(t).every(canMove)))
    memo.set(id, ok)
    return ok
  }

  const waiting: Waiting[] = []
  for (const id of epic.tasks) {
    const t = byId.get(id)
    if (!t) waiting.push({ taskId: id, reason: `${id} has no task file`, why: 'no-file' })
    else if (t.status === 'in-progress') waiting.push({ taskId: id, reason: `${id} is in progress (claimed)`, why: 'in-progress' })
    else if (t.status === 'blocked') waiting.push({ taskId: id, reason: `${id} is blocked`, why: 'blocked' })
    else if (t.status === 'paused') waiting.push({ taskId: id, reason: `${id} is paused — needs a human to resume it`, why: 'paused' })
    else if (t.status === 'review') waiting.push(t.reviewHold
      ? { taskId: id, reason: `${id} in review — needs a human`, why: 'review-hold' }
      : { taskId: id, reason: `${id} in review — waiting for a human to check it`, why: 'review' })
    else if (t.status === 'todo') {
      const deps = unmet(t).map(d => `${d} (${byId.get(d)?.status ?? 'missing'})`)
      waiting.push({ taskId: id, reason: `${id} waits on ${deps.join(', ')}`, why: 'deps', deps })
    }
  }
  return { kind: 'waiting', waiting, needsHuman: waiting.every(w => !canMove(w.taskId)) }
}

/**
 * Claim-response line for a task whose spec's last auto run failed (R058): points the agent at the spec to fix first.
 * Empty when there's no spec or the last run didn't fail.
 */
export function failedRunNote(tests: Pick<NonNullable<Task['manualTests']>, 'spec' | 'autoRun'> | null): string {
  if (!tests?.spec || tests.autoRun?.result !== 'failed') return ''
  return `🤖 Last auto run failed (${tests.autoRun.date}): spec \`${tests.spec}\`. Read the failing step in the report below, fix the code (or a wrong test, never by weakening an assertion) and run it again before done.`
}
