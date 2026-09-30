// Pure next-task picker for an epic's work queue (no fs). Self-check: node src/lib/work-queue.check.mts
import type { RoadmapItem, Task } from './core'

export type QueueTask = Pick<Task, 'id' | 'status' | 'dependsOn'>
export type QueueResult =
  | { kind: 'ready'; taskId: string }
  | { kind: 'finished' }
  // needsHuman: no remaining task can move without someone unblocking or creating a task
  | { kind: 'waiting'; waiting: { taskId: string; reason: string }[]; needsHuman: boolean }

/** Every `T\d+` in a free-text "Depends on" line: "T008, T009 (x)" → ["T008","T009"]. */
export function depIds(dependsOn: string): string[] {
  return [...new Set((dependsOn.match(/\bT\d+\b/gi) ?? []).map(d => d.toUpperCase()))]
}

const settled = (s: Task['status']) => s === 'done' || s === 'cancelled'

export function pickNextTask(epic: RoadmapItem, tasks: QueueTask[]): QueueResult {
  const byId = new Map(tasks.map(t => [t.id, t]))
  const linked = epic.tasks.map(id => byId.get(id)).filter((t): t is QueueTask => !!t)
  const unmet = (t: QueueTask) => depIds(t.dependsOn).filter(d => {
    const dep = byId.get(d)
    return !dep || !settled(dep.status)
  })

  for (const t of linked) {
    if (t.status === 'todo' && !unmet(t).length) return { kind: 'ready', taskId: t.id }
  }
  if (linked.every(t => settled(t.status))) return { kind: 'finished' }

  // Can this task still move without a human? in-progress/settled yes; blocked/paused/review/missing no
  // (review waits for someone to approve or send it back, R043);
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

  const waiting: { taskId: string; reason: string }[] = []
  for (const id of epic.tasks) {
    const t = byId.get(id)
    if (!t) waiting.push({ taskId: id, reason: `${id} has no task file` })
    else if (t.status === 'in-progress') waiting.push({ taskId: id, reason: `${id} is in progress (claimed)` })
    else if (t.status === 'blocked') waiting.push({ taskId: id, reason: `${id} is blocked` })
    else if (t.status === 'paused') waiting.push({ taskId: id, reason: `${id} is paused — needs a human to resume it` })
    else if (t.status === 'review') waiting.push({ taskId: id, reason: `${id} in review — needs a human` })
    else if (t.status === 'todo') {
      const deps = unmet(t).map(d => `${d} (${byId.get(d)?.status ?? 'missing'})`)
      waiting.push({ taskId: id, reason: `${id} waits on ${deps.join(', ')}` })
    }
  }
  return { kind: 'waiting', waiting, needsHuman: waiting.every(w => !canMove(w.taskId)) }
}
