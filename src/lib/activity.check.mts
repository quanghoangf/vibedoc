// Self-check for activity event reading. Run: node src/lib/activity.check.mts
import assert from 'node:assert/strict'
import type { ActivityEvent } from './core'
import { eventAction, eventCategory, eventTarget, filterEvents } from './activity.ts'

let n = 0
const ev = (type: ActivityEvent['type'], title: string, extra: Partial<ActivityEvent> = {}): ActivityEvent =>
  ({ id: `e${n++}`, timestamp: '2026-10-04T09:00:00.000Z', type, actor: 'ai', title, ...extra })

// [event, category, action, target] — titles exactly as core.ts writes them
const cases: [ActivityEvent, string, string, unknown][] = [
  [ev('task_updated', 'T055 moved to done', { taskId: 'T055', taskStatus: 'done' }), 'task', 'moved', { kind: 'task', id: 'T055' }],
  [ev('task_updated', 'T055 created', { taskId: 'T055' }), 'task', 'created', { kind: 'task', id: 'T055' }],
  [ev('task_updated', 'T055 edited', { taskId: 'T055' }), 'task', 'edited', { kind: 'task', id: 'T055' }],
  [ev('task_updated', 'T055 deleted', { taskId: 'T055' }), 'task', 'deleted', null],
  [ev('task_updated', 'T055 restored', { taskId: 'T055' }), 'task', 'restored', { kind: 'task', id: 'T055' }],
  [ev('roadmap_updated', 'R004 updated', { detail: 'Epic' }), 'epic', 'updated', { kind: 'epic', id: 'R004' }],
  [ev('roadmap_updated', 'R004 created'), 'epic', 'created', { kind: 'epic', id: 'R004' }],
  [ev('roadmap_updated', 'R004 deleted'), 'epic', 'deleted', null],
  [ev('roadmap_updated', 'Roadmap generated (12 items)'), 'epic', 'created', null],
  [ev('memory_updated', 'Session memory updated'), 'memory', 'updated', { kind: 'memory' }],
  [ev('memory_updated', 'Restored MEMORY.md from 2026-10-01'), 'memory', 'restored', { kind: 'memory' }],
  [ev('memory_updated', 'Entry E012 saved'), 'memory', 'saved', { kind: 'entry', id: 'E012' }],
  [ev('memory_updated', 'Entry E012 deleted'), 'memory', 'deleted', null],
  [ev('memory_updated', 'Entries merged into E003'), 'memory', 'merged', { kind: 'entry', id: 'E003' }],
  [ev('memory_updated', 'Merge into E003 undone'), 'memory', 'undone', { kind: 'entry', id: 'E003' }],
  [ev('memory_updated', 'Cleanup flag dismissed'), 'memory', 'dismissed', { kind: 'memory' }],
  [ev('decision_logged', 'ADR-005: Nothing blocks done'), 'decision', 'logged', { kind: 'doc', path: 'ADR-005' }],
  [ev('doc_created', 'Created: docs/a.md', { detail: 'docs/a.md' }), 'doc', 'created', { kind: 'doc', path: 'docs/a.md' }],
  [ev('doc_updated', 'Edited docs/a.md', { detail: 'docs/a.md' }), 'doc', 'edited', { kind: 'doc', path: 'docs/a.md' }],
  [ev('doc_renamed', 'Renamed docs/a.md → docs/b.md'), 'doc', 'renamed', { kind: 'doc', path: 'docs/b.md' }],
  [ev('doc_deleted', 'Deleted docs/a.md'), 'doc', 'deleted', null],
  [ev('registry_rebuilt', 'Document registry rebuilt'), 'doc', 'rebuilt', null],
  [ev('session_start', 'Session started'), 'session', 'connected', null],
]
for (const [e, category, action, target] of cases) {
  assert.equal(eventCategory(e), category, e.title)
  assert.equal(eventAction(e), action, e.title)
  assert.deepEqual(eventTarget(e), target, e.title)
}

const all = cases.map(c => c[0])
all[0] = { ...all[0], actor: 'human' }
assert.equal(filterEvents(all, { category: null, actor: null }).length, all.length)
assert.equal(filterEvents(all, { category: 'doc', actor: null }).length, 5)
assert.equal(filterEvents(all, { category: 'task', actor: 'human' }).length, 1)
assert.equal(filterEvents(all, { category: 'task', actor: 'ai' }).length, 4)

console.log(`activity: ${cases.length} cases ok`)
