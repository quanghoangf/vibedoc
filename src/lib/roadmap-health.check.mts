// Self-check for roadmap-health. Run: node src/lib/roadmap-health.check.mts
import assert from 'node:assert/strict'
import type { RoadmapItem } from './core'
import { dueState, roadmapHealth } from './roadmap-health.ts'

const item = (id: string, parent: string | null, status: RoadmapItem['status'], tasks: string[] = [], due: string | null = null): RoadmapItem =>
  ({ id, title: id, parent, status, order: 10, tasks, due, body: '', file: `${id}.md` })

const items = [
  item('R001', null, 'planned'),
  item('R002', 'R001', 'planned', ['T001', 'T002']),   // all done -> should be done
  item('R003', 'R001', 'done', ['T003']),              // shipped with open task
  item('R004', 'R001', 'planned', ['T004', 'T009']),   // cancelled + missing
  item('R005', null, 'done', [], '2026-01-01'),        // horizon without features, done: no drift even if past due
  item('R006', null, 'planned', [], '2026-09-27'),     // horizon without features, past due: overdue
]
const TODAY = '2026-09-28'
const { progress, drift } = roadmapHealth(items, { T001: 'done', T002: 'done', T003: 'todo', T004: 'cancelled' }, TODAY)

assert.deepEqual(progress.R002, { done: 2, total: 2 })
assert.deepEqual(progress.R003, { done: 0, total: 1 })
assert.equal(progress.R004, undefined, 'cancelled-only tasks give no progress')
assert.deepEqual(progress.R001, { done: 1, total: 3 })
const by = (id: string, kind: string) => drift.find(d => d.id === id && d.kind === kind)
assert.equal(by('R002', 'status-mismatch')?.suggestedStatus, 'done')
assert.equal(by('R003', 'status-mismatch')?.suggestedStatus, 'planned')
assert.ok(by('R004', 'missing-task')?.message.includes('T009'))
assert.equal(by('R001', 'status-mismatch')?.suggestedStatus, 'in-progress')
assert.equal(drift.filter(d => d.id === 'R005').length, 0)
assert.ok(by('R006', 'overdue')?.message.includes('2026-09-27'))

assert.equal(dueState(null, 'planned', TODAY), null)
assert.equal(dueState('2026-09-27', 'planned', TODAY), 'overdue')
assert.equal(dueState('2026-09-27', 'done', TODAY), 'done')
assert.equal(dueState('2026-09-28', 'planned', TODAY), 'soon')
assert.equal(dueState('2026-10-05', 'in-progress', TODAY), 'soon', '7 days away is soon')
assert.equal(dueState('2026-10-06', 'planned', TODAY), 'ok')
assert.equal(dueState('2027-01-01', 'planned', '2026-12-30'), 'soon', 'across a year boundary')
console.log('roadmap-health: ok')
