/**
 * src/lib/sessions.ts
 * Pure grouping of the activity log into agent/human sessions (no fs). Used by /api/sessions and /api/mcp.
 * Stamped events group by `sessionId`; legacy events (no sessionId) split on a per-actor idle gap or `session_start`.
 */
import type { ActivityEvent, TaskStatus } from './core'

export const SESSION_GAP_MS = 30 * 60 * 1000

export interface Session {
  id: string
  actor: ActivityEvent['actor']
  start: string
  end: string
  eventCount: number
  eventIds: string[]
  tasks: { id: string; lastStatus: TaskStatus }[]
  docs: string[]
  decisions: string[]
  memoryUpdated: boolean
  /** roadmap_updated events (R078: the UI builds its own headline from these fields) */
  roadmapEdits: number
  /** English summary for MCP and episodes */
  headline: string
}

// Doc path a change event carries; null for events that don't change a doc (doc_read included).
function changedDoc(e: ActivityEvent): string | null {
  switch (e.type) {
    case 'doc_created': return e.detail ?? e.title.replace(/^Created: /, '')
    case 'doc_deleted': return e.title.replace(/^Deleted /, '')
    case 'doc_renamed': return e.title.split(' → ')[1] ?? null
    default: return null
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function summarize(id: string, events: ActivityEvent[]): Session {
  const tasks = new Map<string, TaskStatus>()
  const docs = new Set<string>()
  const decisions: string[] = []
  let memoryUpdated = false
  let roadmapEdits = 0
  for (const e of events) {
    if (e.type === 'task_updated' && e.taskId && e.taskStatus) tasks.set(e.taskId, e.taskStatus)
    const doc = changedDoc(e)
    if (doc) docs.add(doc)
    if (e.type === 'decision_logged') decisions.push(e.title)
    if (e.type === 'memory_updated') memoryUpdated = true
    if (e.type === 'roadmap_updated') roadmapEdits++
  }
  const taskList = [...tasks].map(([tid, lastStatus]) => ({ id: tid, lastStatus }))
  const done = taskList.filter(t => t.lastStatus === 'done').length
  const parts = [
    taskList.length ? `${plural(taskList.length, 'task')} moved${done ? ` (${done} done)` : ''}` : '',
    docs.size ? `${plural(docs.size, 'doc')} changed` : '',
    decisions.length ? plural(decisions.length, 'ADR') : '',
    roadmapEdits ? plural(roadmapEdits, 'roadmap edit') : '',
    memoryUpdated ? 'memory updated' : '',
  ].filter(Boolean)
  return {
    id,
    actor: events[0].actor,
    start: events[0].timestamp,
    end: events[events.length - 1].timestamp,
    eventCount: events.length,
    eventIds: events.map(e => e.id),
    tasks: taskList,
    docs: [...docs],
    decisions,
    memoryUpdated,
    roadmapEdits,
    headline: parts.join(' · ') || plural(events.length, 'event'),
  }
}

/** Events may come in any order (the log is newest-first). Returns sessions newest first. */
export function groupSessions(events: ActivityEvent[], opts: { gapMs?: number } = {}): Session[] {
  const gapMs = opts.gapMs ?? SESSION_GAP_MS
  const chrono = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const groups = new Map<string, ActivityEvent[]>()
  const legacy = new Map<string, { id: string; lastAt: number }>() // per actor
  for (const e of chrono) {
    let id = e.sessionId
    if (!id) {
      const at = Date.parse(e.timestamp)
      let cur = legacy.get(e.actor)
      if (!cur || e.type === 'session_start' || at - cur.lastAt > gapMs) {
        cur = { id: `legacy_${e.id}`, lastAt: at }
        legacy.set(e.actor, cur)
      }
      cur.lastAt = at
      id = cur.id
    }
    const g = groups.get(id)
    if (g) g.push(e)
    else groups.set(id, [e])
  }
  return [...groups]
    .map(([id, evs]) => summarize(id, evs))
    .sort((a, b) => b.start.localeCompare(a.start))
}

export function sessionDuration(s: Pick<Session, 'start' | 'end'>): string {
  const min = Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60_000)
  if (min < 1) return '<1m'
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`
}

/** A session still receiving events (last one within `windowMs`). */
export function isLive(s: Pick<Session, 'end'>, now = Date.now(), windowMs = 5 * 60 * 1000): boolean {
  return now - Date.parse(s.end) < windowMs
}

/** Totals for the "catch up" strip: sessions that ended at or after `sinceMs`. */
export function catchUp(sessions: Session[], sinceMs: number) {
  const recent = sessions.filter(s => Date.parse(s.end) >= sinceMs)
  return {
    sessions: recent.length,
    tasksDone: new Set(recent.flatMap(s => s.tasks.filter(t => t.lastStatus === 'done').map(t => t.id))).size,
    docs: new Set(recent.flatMap(s => s.docs)).size,
    decisions: recent.reduce((n, s) => n + s.decisions.length, 0),
  }
}

export function sessionsForTask(sessions: Session[], taskId: string): Session[] {
  return sessions.filter(s => s.tasks.some(t => t.id === taskId))
}
