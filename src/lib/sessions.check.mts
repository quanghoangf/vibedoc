// Self-check for sessions. Run: node src/lib/sessions.check.mts
import assert from 'node:assert/strict'
import type { ActivityEvent } from './core'
import { catchUp, groupSessions, isLive, sessionDuration, sessionsForTask } from './sessions.ts'

let n = 0
const at = (min: number) => new Date(Date.UTC(2026, 8, 28, 9, 0) + min * 60_000).toISOString()
const ev = (min: number, type: ActivityEvent['type'], extra: Partial<ActivityEvent> = {}): ActivityEvent =>
  ({ id: `e${++n}`, timestamp: at(min), type, actor: 'ai', title: type, ...extra })
const moved = (min: number, taskId: string, taskStatus: ActivityEvent['taskStatus'], extra: Partial<ActivityEvent> = {}) =>
  ev(min, 'task_updated', { taskId, taskStatus, ...extra })

// Legacy: gap > 30 min splits; session_start splits; stored newest-first.
const legacy = [
  ev(0, 'session_start'),
  moved(5, 'T001', 'in-progress'),
  moved(20, 'T001', 'done'),
  moved(60, 'T002', 'in-progress'),     // 40 min gap -> new session
  ev(65, 'session_start'),              // explicit split
  moved(70, 'T003', 'done'),
].reverse()
const ls = groupSessions(legacy)
assert.equal(ls.length, 3)
assert.deepEqual(ls.map(s => s.eventCount), [2, 1, 3])  // newest first
assert.deepEqual(ls[2].tasks, [{ id: 'T001', lastStatus: 'done' }])
assert.equal(ls[2].start, at(0))
assert.equal(ls[2].end, at(20))
assert.deepEqual(ls[2].eventIds, legacy.slice(3).reverse().map(e => e.id))

// Actors split independently.
const human = ev(10, 'doc_created', { actor: 'human', detail: 'docs/a.md' })
assert.equal(groupSessions([...legacy, human]).length, 4)

// Mixed: stamped events group by id regardless of gap; legacy ones around them still gap-split.
const mixed = [
  moved(0, 'T001', 'done', { sessionId: 'ses_1' }),
  moved(120, 'T002', 'done', { sessionId: 'ses_1' }),
  moved(10, 'T009', 'todo'),
]
const ms = groupSessions(mixed)
assert.equal(ms.length, 2)
assert.deepEqual(ms.find(s => s.id === 'ses_1')?.tasks.map(t => t.id), ['T001', 'T002'])
assert.equal(ms.find(s => s.id !== 'ses_1')?.id, `legacy_${mixed[2].id}`)

// Headline counts; doc_read is not a change; docs from created/deleted/renamed.
const busy = groupSessions([
  moved(0, 'T001', 'done'), moved(1, 'T002', 'done'), moved(2, 'T003', 'in-progress'),
  ev(3, 'doc_created', { detail: 'docs/a.md' }),
  ev(4, 'doc_renamed', { title: 'Renamed docs/b.md → docs/c.md' }),
  ev(5, 'doc_deleted', { title: 'Deleted docs/d.md' }),
  ev(6, 'doc_read', { detail: 'docs/e.md' }),
  ev(7, 'decision_logged', { title: 'ADR-004: Use SSE' }),
  ev(8, 'memory_updated'),
  ev(9, 'roadmap_updated'),
])[0]
assert.deepEqual(busy.docs, ['docs/a.md', 'docs/c.md', 'docs/d.md'])
assert.deepEqual(busy.decisions, ['ADR-004: Use SSE'])
assert.equal(busy.memoryUpdated, true)
assert.equal(busy.headline, '3 tasks moved (2 done) · 3 docs changed · 1 ADR · 1 roadmap edit · memory updated')
assert.equal(groupSessions([ev(0, 'session_start')])[0].headline, '1 event')

assert.equal(sessionDuration({ start: at(0), end: at(0) }), '<1m')
assert.equal(sessionDuration({ start: at(0), end: at(95) }), '1h 35m')

// isLive / catchUp
assert.equal(isLive({ end: at(0) }, Date.parse(at(4))), true)
assert.equal(isLive({ end: at(0) }, Date.parse(at(6))), false)
assert.deepEqual(catchUp(ls, Date.parse(at(60))), { sessions: 2, tasksDone: 1, docs: 0, decisions: 0 })
assert.deepEqual(catchUp([busy, busy], 0), { sessions: 2, tasksDone: 2, docs: 3, decisions: 2 })

// sessionsForTask
assert.equal(sessionsForTask(ls, 'T001').length, 1)
assert.equal(sessionsForTask(ls, 'T404').length, 0)

console.log('sessions: ok')
