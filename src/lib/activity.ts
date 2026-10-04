/**
 * src/lib/activity.ts
 * Pure reading of one activity event (no fs): which kind of item it touched, the verb, and where clicking it goes.
 * Titles are parsed, not changed: touchedPaths, sessions.ts and episodes.ts parse the same formats.
 */
import type { ActivityEvent } from './core'

export type EventCategory = 'task' | 'doc' | 'epic' | 'memory' | 'decision' | 'session'
export const EVENT_CATEGORIES: { id: EventCategory; label: string }[] = [
  { id: 'task', label: 'Tasks' },
  { id: 'doc', label: 'Docs' },
  { id: 'epic', label: 'Epics' },
  { id: 'memory', label: 'Memory' },
  { id: 'decision', label: 'Decisions' },
  { id: 'session', label: 'Sessions' },
]

export type EventAction =
  | 'created' | 'edited' | 'moved' | 'deleted' | 'restored' | 'renamed'
  | 'saved' | 'merged' | 'undone' | 'dismissed' | 'logged' | 'connected' | 'rebuilt' | 'read' | 'updated'

export type EventTarget =
  | { kind: 'task'; id: string }
  | { kind: 'epic'; id: string }
  | { kind: 'entry'; id: string }
  | { kind: 'memory' }
  | { kind: 'doc'; path: string }

const CATEGORY: Record<ActivityEvent['type'], EventCategory> = {
  task_updated: 'task',
  roadmap_updated: 'epic',
  memory_updated: 'memory',
  decision_logged: 'decision',
  session_start: 'session',
  doc_read: 'doc',
  doc_created: 'doc',
  doc_updated: 'doc',
  doc_deleted: 'doc',
  doc_renamed: 'doc',
  registry_rebuilt: 'doc',
}

export const eventCategory = (e: ActivityEvent): EventCategory => CATEGORY[e.type] ?? 'doc'

const BY_TYPE: Partial<Record<ActivityEvent['type'], EventAction>> = {
  doc_created: 'created',
  doc_updated: 'edited',
  doc_deleted: 'deleted',
  doc_renamed: 'renamed',
  doc_read: 'read',
  decision_logged: 'logged',
  session_start: 'connected',
  registry_rebuilt: 'rebuilt',
}

// Verbs as core.ts writes them: "T055 moved to done", "Entry E012 saved", "Merge into E003 undone", "R004 created"
const TITLE_VERBS: [RegExp, EventAction][] = [
  [/\bmoved to\b/, 'moved'],
  [/\bundone$/, 'undone'],
  [/\bmerged\b/i, 'merged'],
  [/\bdismissed$/, 'dismissed'],
  [/^Restored\b|\brestored$/, 'restored'],
  [/\bcreated\b/, 'created'],
  [/\bdeleted$/, 'deleted'],
  [/\bedited$/, 'edited'],
  [/\bsaved$/, 'saved'],
  [/\bgenerated\b/, 'created'],
]

export function eventAction(e: ActivityEvent): EventAction {
  const fixed = BY_TYPE[e.type]
  if (fixed) return fixed
  return TITLE_VERBS.find(([re]) => re.test(e.title))?.[1] ?? 'updated'
}

export function eventTarget(e: ActivityEvent): EventTarget | null {
  const action = eventAction(e)
  if (action === 'deleted') return null
  switch (e.type) {
    case 'task_updated': return e.taskId ? { kind: 'task', id: e.taskId } : null
    case 'roadmap_updated': {
      const id = e.title.match(/^(R\d+)\b/)?.[1]
      return id ? { kind: 'epic', id } : null
    }
    case 'memory_updated': {
      const id = e.title.match(/\b(E\d+)\b/)?.[1]
      return id ? { kind: 'entry', id } : { kind: 'memory' }
    }
    case 'decision_logged': {
      const id = e.title.match(/^(ADR-\d+)/)?.[1]
      return id ? { kind: 'doc', path: id } : null
    }
    case 'doc_created':
    case 'doc_updated':
    case 'doc_read': {
      const p = e.detail ?? e.title.replace(/^(Created:|Edited)\s*/, '')
      return p ? { kind: 'doc', path: p } : null
    }
    case 'doc_renamed': {
      const p = e.title.split(' → ')[1]?.trim()
      return p ? { kind: 'doc', path: p } : null
    }
    default: return null
  }
}

/** Category + actor filter for the "All events" list; null = no filter on that axis. */
export function filterEvents(
  events: ActivityEvent[],
  { category, actor }: { category: EventCategory | null; actor: ActivityEvent['actor'] | null },
): ActivityEvent[] {
  return events.filter(e => (!category || eventCategory(e) === category) && (!actor || e.actor === actor))
}
