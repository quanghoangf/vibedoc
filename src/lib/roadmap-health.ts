/**
 * src/lib/roadmap-health.ts
 * Pure (no fs): roadmap progress + drift, shared by the Roadmap page and the MCP handler.
 * A feature's expected status comes from its linked tasks; a horizon's from its features.
 */

import type { RoadmapItem, RoadmapStatus, TaskStatus } from './core'

export interface RoadmapProgress { done: number; total: number }

export interface RoadmapDrift {
  id: string
  kind: 'status-mismatch' | 'missing-task'
  message: string
  suggestedStatus?: RoadmapStatus
}

export interface RoadmapHealth {
  progress: Record<string, RoadmapProgress>
  drift: RoadmapDrift[]
}

type Started = 'done' | 'in-progress' | 'other'

function expectedStatus(states: Started[]): RoadmapStatus {
  if (states.every(s => s === 'done')) return 'done'
  if (states.some(s => s !== 'other')) return 'in-progress'
  return 'planned'
}

export function roadmapHealth(items: RoadmapItem[], taskStatus: Record<string, TaskStatus>): RoadmapHealth {
  const progress: Record<string, RoadmapProgress> = {}
  const drift: RoadmapDrift[] = []
  const horizonIds = new Set(items.filter(i => i.parent === null).map(i => i.id))

  for (const item of items) {
    if (item.parent === null) continue
    const missing = item.tasks.filter(t => !(t in taskStatus))
    if (missing.length) {
      drift.push({ id: item.id, kind: 'missing-task', message: `${item.id} links unknown task ${missing.join(', ')}` })
    }
    // cancelled tasks don't count toward progress or expected status
    const linked = item.tasks.filter(t => t in taskStatus && taskStatus[t] !== 'cancelled')
    if (!linked.length) continue
    const states: Started[] = linked.map(t =>
      taskStatus[t] === 'done' ? 'done' : taskStatus[t] === 'in-progress' ? 'in-progress' : 'other')
    progress[item.id] = { done: states.filter(s => s === 'done').length, total: linked.length }
    const expected = expectedStatus(states)
    if (expected !== item.status) {
      const open = linked.filter(t => taskStatus[t] !== 'done')
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
