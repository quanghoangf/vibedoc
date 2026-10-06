/**
 * src/lib/roadmap-health.ts
 * Pure (no fs): roadmap progress + drift, shared by the Roadmap page and the MCP handler.
 * A feature's expected status comes from its linked tasks; a horizon's from its features.
 */

import type { RoadmapItem, RoadmapStatus, Task } from './core'

/** What health needs from a task: status for progress, due for at-risk, covers for scenario coverage (R068). */
export type TaskInfo = Pick<Task, 'status' | 'due'> & { covers?: string[] }

export interface RoadmapProgress { done: number; total: number }

/** Why an epic is at risk, as data (the UI words it in its own language; `message` keeps the English). */
export type RiskReason =
  | { why: 'task-overdue'; id: string; due: string }
  | { why: 'task-blocked'; id: string }
  | { why: 'nothing-started'; due: string }

export interface RoadmapDrift {
  id: string
  kind: 'status-mismatch' | 'missing-task' | 'overdue' | 'at-risk' | 'uncovered-scenario' | 'spec-unmerged' | 'spec-conflict'
  /** English sentence (MCP, logs) */
  message: string
  /** The values `message` is built from, for a UI that words it itself (R078) */
  vars: Record<string, string>
  /** status-mismatch only: which sentence */
  variant?: 'all-done' | 'not-done' | 'horizon'
  /** at-risk only */
  risks?: RiskReason[]
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

export interface TaskDueSummary { overdue: number; next: string | null }

/** Open tasks' deadlines for a map node: how many are overdue, and the nearest upcoming due. */
export function taskDueSummary(taskIds: string[], tasks: Record<string, TaskInfo>, today: string): TaskDueSummary | null {
  const dues = taskIds
    .map(id => tasks[id])
    .filter(t => t && t.due && t.status !== 'done' && t.status !== 'cancelled')
    .map(t => t.due as string)
  if (!dues.length) return null
  const upcoming = dues.filter(d => d >= today).sort()
  return { overdue: dues.length - upcoming.length, next: upcoming[0] ?? null }
}

/** Why an unfinished epic may miss its date: overdue or blocked tasks, or due soon with nothing started. */
function atRiskReasons(item: RoadmapItem, linked: string[], tasks: Record<string, TaskInfo>, today: string): RiskReason[] {
  const reasons: RiskReason[] = []
  for (const id of linked) {
    const t = tasks[id]
    if (t.status !== 'done' && t.due && t.due < today) reasons.push({ why: 'task-overdue', id, due: t.due })
    if (t.status === 'blocked') reasons.push({ why: 'task-blocked', id })
  }
  const started = linked.some(id => ['done', 'in-progress', 'review'].includes(tasks[id].status))
  if (item.due && dueState(item.due, item.status, today) === 'soon' && !started) {
    reasons.push({ why: 'nothing-started', due: item.due })
  }
  return reasons
}

function riskText(r: RiskReason): string {
  return r.why === 'task-overdue' ? `${r.id} overdue since ${r.due}` : r.why === 'task-blocked' ? `${r.id} blocked` : `due ${r.due}, nothing started`
}

export function roadmapHealth(
  items: RoadmapItem[], tasks: Record<string, TaskInfo>, today: string,
): RoadmapHealth {
  const progress: Record<string, RoadmapProgress> = {}
  const drift: RoadmapDrift[] = []

  for (const item of items) {
    if (item.due && dueState(item.due, item.status, today) === 'overdue') {
      drift.push({ id: item.id, kind: 'overdue', message: `${item.id} "${item.title}" is overdue since ${item.due}`, vars: { id: item.id, title: item.title, due: item.due } })
    }
  }
  const horizonIds = new Set(items.filter(i => i.parent === null).map(i => i.id))

  // R069: spec changes that never reached the capability spec, and two open epics changing the same requirement
  for (const item of items) {
    if (item.parent !== null && item.status === 'done' && item.specChanges?.length && !item.specMerged) {
      const specs = item.specChanges.map(c => c.capability).join(', ')
      drift.push({ id: item.id, kind: 'spec-unmerged', message: `${item.id} "${item.title}" is done but its spec changes aren't merged into ${specs}`, vars: { id: item.id, title: item.title, specs } })
    }
  }
  const open = items.filter(i => i.parent !== null && i.specChanges?.length && (i.status !== 'done' || !i.specMerged))
  const seen = new Set<string>()
  for (const [n, a] of open.entries()) {
    for (const b of open.slice(n + 1)) {
      for (const ca of a.specChanges ?? []) {
        for (const oa of ca.ops) {
          if (oa.op === 'ADDED') continue
          const hit = (b.specChanges ?? []).some(cb => cb.capability === ca.capability &&
            cb.ops.some(ob => ob.op !== 'ADDED' && ob.name.trim().toLowerCase() === oa.name.trim().toLowerCase()))
          const key = `${a.id}|${b.id}|${ca.capability}|${oa.name.toLowerCase()}`
          if (!hit || seen.has(key)) continue
          seen.add(key)
          drift.push({ id: a.id, kind: 'spec-conflict', message: `${a.id} and ${b.id} both change "${oa.name}" in ${ca.capability}`, vars: { a: a.id, b: b.id, name: oa.name, spec: ca.capability } })
        }
      }
    }
  }

  for (const item of items) {
    if (item.parent === null) continue
    const missing = item.tasks.filter(t => !(t in tasks))
    if (missing.length) {
      drift.push({ id: item.id, kind: 'missing-task', message: `${item.id} links unknown task ${missing.join(', ')}`, vars: { id: item.id, tasks: missing.join(', ') } })
    }
    // cancelled tasks don't count toward progress or expected status
    const linked = item.tasks.filter(t => t in tasks && tasks[t].status !== 'cancelled')
    // a paused epic is stopped on purpose: not at risk
    const risks = item.status === 'done' || item.status === 'paused' ? [] : atRiskReasons(item, linked, tasks, today)
    if (risks.length) {
      drift.push({ id: item.id, kind: 'at-risk', message: `${item.id} "${item.title}" at risk: ${risks.map(riskText).join('; ')}`, vars: { id: item.id, title: item.title }, risks })
    }
    if (!linked.length) continue
    // R068: an epic being worked on whose scenarios aren't all covered by a task (no scenarios → nothing to check)
    if ((item.status === 'planned' || item.status === 'in-progress') && item.scenarios?.length) {
      const covered = new Set(linked.flatMap(t => tasks[t].covers ?? []))
      const uncovered = item.scenarios.map(sc => sc.id).filter(id => !covered.has(id))
      if (uncovered.length) {
        drift.push({ id: item.id, kind: 'uncovered-scenario', message: `${item.id}: ${uncovered.join(', ')} not covered by any task`, vars: { id: item.id, scenarios: uncovered.join(', ') } })
      }
    }
    const states: Started[] = linked.map(t =>
      tasks[t].status === 'done' ? 'done' : tasks[t].status === 'in-progress' || tasks[t].status === 'review' ? 'in-progress' : 'other')
    progress[item.id] = { done: states.filter(s => s === 'done').length, total: linked.length }
    const expected = expectedStatus(states)
    // paused stays paused until everything is done
    if (expected !== item.status && !(item.status === 'paused' && expected !== 'done')) {
      const open = linked.filter(t => tasks[t].status !== 'done')
      drift.push({
        id: item.id,
        kind: 'status-mismatch',
        message: expected === 'done'
          ? `${item.id} "${item.title}": all tasks done but status is ${item.status}`
          : `${item.id} "${item.title}" is ${item.status} but tasks ${open.join(', ')} are not done`,
        vars: { id: item.id, title: item.title, status: item.status, tasks: open.join(', ') },
        variant: expected === 'done' ? 'all-done' : 'not-done',
        suggestedStatus: expected,
      })
    }
  }

  for (const h of items) {
    if (!horizonIds.has(h.id)) continue
    const kids = items.filter(i => i.parent === h.id)
    if (!kids.length) continue
    const states: Started[] = kids.map(k => k.status === 'done' ? 'done' : k.status === 'in-progress' ? 'in-progress' : 'other')
    // weight by tasks; an epic not broken down yet counts as one unit
    progress[h.id] = kids.reduce((sum, k) => {
      const p = progress[k.id] ?? { done: k.status === 'done' ? 1 : 0, total: 1 }
      return { done: sum.done + p.done, total: sum.total + p.total }
    }, { done: 0, total: 0 })
    const expected = expectedStatus(states)
    if (expected !== h.status && !(h.status === 'paused' && expected !== 'done')) {
      drift.push({
        id: h.id,
        kind: 'status-mismatch',
        message: `${h.id} "${h.title}" is ${h.status} but its features say ${expected}`,
        vars: { id: h.id, title: h.title, status: h.status, expected },
        variant: 'horizon',
        suggestedStatus: expected,
      })
    }
  }

  return { progress, drift }
}
