/**
 * src/lib/roadmap-health.ts
 * Pure (no fs): roadmap progress + drift, shared by the Roadmap page and the MCP handler.
 * A feature's expected status comes from its linked tasks; a horizon's from its features.
 */

import type { RoadmapItem, RoadmapStatus, Task } from './core'

/** What health needs from a task: status for progress, due for at-risk. */
export type TaskInfo = Pick<Task, 'status' | 'due'>

export interface RoadmapProgress { done: number; total: number }

export interface RoadmapDrift {
  id: string
  kind: 'status-mismatch' | 'missing-task' | 'overdue' | 'at-risk'
  message: string
  suggestedStatus?: RoadmapStatus
}

export interface RoadmapHealth {
  progress: Record<string, RoadmapProgress>
  drift: RoadmapDrift[]
}

export type DueState = 'overdue' | 'soon' | 'ok' | 'done'

const SOON_DAYS = 7

/** Local calendar date "YYYY-MM-DD" (due dates are calendar dates, not instants). */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

function daysBetween(from: string, to: string): number {
  const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

export function dueState(due: string | null, status: RoadmapStatus, today: string): DueState | null {
  if (!due) return null
  if (status === 'done') return 'done'
  if (due < today) return 'overdue'
  return daysBetween(today, due) <= SOON_DAYS ? 'soon' : 'ok'
}

type Started = 'done' | 'in-progress' | 'other'

function expectedStatus(states: Started[]): RoadmapStatus {
  if (states.every(s => s === 'done')) return 'done'
  if (states.some(s => s !== 'other')) return 'in-progress'
  return 'planned'
}

/** Why an unfinished epic may miss its date: overdue or blocked tasks, or due soon with nothing started. */
function atRiskReasons(item: RoadmapItem, linked: string[], tasks: Record<string, TaskInfo>, today: string): string[] {
  const reasons: string[] = []
  for (const id of linked) {
    const t = tasks[id]
    if (t.status !== 'done' && t.due && t.due < today) reasons.push(`${id} overdue since ${t.due}`)
    if (t.status === 'blocked') reasons.push(`${id} blocked`)
  }
  const started = linked.some(id => tasks[id].status === 'done' || tasks[id].status === 'in-progress')
  if (item.due && dueState(item.due, item.status, today) === 'soon' && !started) {
    reasons.push(`due ${item.due}, nothing started`)
  }
  return reasons
}

export function roadmapHealth(
  items: RoadmapItem[], tasks: Record<string, TaskInfo>, today: string,
): RoadmapHealth {
  const progress: Record<string, RoadmapProgress> = {}
  const drift: RoadmapDrift[] = []

  for (const item of items) {
    if (item.due && dueState(item.due, item.status, today) === 'overdue') {
      drift.push({ id: item.id, kind: 'overdue', message: `${item.id} "${item.title}" is overdue since ${item.due}` })
    }
  }
  const horizonIds = new Set(items.filter(i => i.parent === null).map(i => i.id))

  for (const item of items) {
    if (item.parent === null) continue
    const missing = item.tasks.filter(t => !(t in tasks))
    if (missing.length) {
      drift.push({ id: item.id, kind: 'missing-task', message: `${item.id} links unknown task ${missing.join(', ')}` })
    }
    // cancelled tasks don't count toward progress or expected status
    const linked = item.tasks.filter(t => t in tasks && tasks[t].status !== 'cancelled')
    const risks = item.status === 'done' ? [] : atRiskReasons(item, linked, tasks, today)
    if (risks.length) {
      drift.push({ id: item.id, kind: 'at-risk', message: `${item.id} "${item.title}" at risk: ${risks.join('; ')}` })
    }
    if (!linked.length) continue
    const states: Started[] = linked.map(t =>
      tasks[t].status === 'done' ? 'done' : tasks[t].status === 'in-progress' ? 'in-progress' : 'other')
    progress[item.id] = { done: states.filter(s => s === 'done').length, total: linked.length }
    const expected = expectedStatus(states)
    if (expected !== item.status) {
      const open = linked.filter(t => tasks[t].status !== 'done')
      drift.push({
        id: item.id,
        kind: 'status-mismatch',
        message: expected === 'done'
          ? `${item.id} "${item.title}": all tasks done but status is ${item.status}`
          : `${item.id} "${item.title}" is ${item.status} but tasks ${open.join(', ')} are not done`,
        suggestedStatus: expected,
      })
    }
  }

  for (const h of items) {
    if (!horizonIds.has(h.id)) continue
    const kids = items.filter(i => i.parent === h.id)
    if (!kids.length) continue
    const states: Started[] = kids.map(k => k.status === 'done' ? 'done' : k.status === 'in-progress' ? 'in-progress' : 'other')
    progress[h.id] = { done: states.filter(s => s === 'done').length, total: kids.length }
    const expected = expectedStatus(states)
    if (expected !== h.status) {
      drift.push({
        id: h.id,
        kind: 'status-mismatch',
        message: `${h.id} "${h.title}" is ${h.status} but its features say ${expected}`,
        suggestedStatus: expected,
      })
    }
  }

  return { progress, drift }
}
