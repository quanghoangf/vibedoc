// Self-check for roadmap-health. Run: node src/lib/roadmap-health.check.mts
import assert from 'node:assert/strict'
import type { RoadmapItem } from './core'
import { dueState, roadmapHealth, taskDueSummary, type TaskInfo } from './roadmap-health.ts'

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
const st = (status: TaskInfo['status'], due: string | null = null): TaskInfo => ({ status, due })
const { progress, drift } = roadmapHealth(items, { T001: st('done'), T002: st('done'), T003: st('todo'), T004: st('cancelled') }, TODAY)

assert.deepEqual(progress.R002, { done: 2, total: 2 })
assert.deepEqual(progress.R003, { done: 0, total: 1 })
assert.equal(progress.R004, undefined, 'cancelled-only tasks give no progress')
assert.deepEqual(progress.R001, { done: 2, total: 4 }, 'horizon counts tasks: 2/2 + 0/1 + untasked 0/1')
{
  const half = roadmapHealth([
    item('H', null, 'in-progress'),
    item('E1', 'H', 'in-progress', ['A1', 'A2']),
    item('E2', 'H', 'planned', ['B1', 'B2']),
  ], { A1: st('done'), A2: st('todo'), B1: st('todo'), B2: st('todo') }, TODAY)
  assert.deepEqual(half.progress.H, { done: 1, total: 4 })
  const untasked = roadmapHealth([item('H', null, 'in-progress'), item('E1', 'H', 'done'), item('E2', 'H', 'planned')], {}, TODAY)
  assert.deepEqual(untasked.progress.H, { done: 1, total: 2 }, 'no tasks: done epics / epics')
}
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

// at-risk: overdue task, blocked task, due soon with nothing started — one entry per epic
{
  const risk = roadmapHealth([
    item('H', null, 'in-progress'),
    item('E1', 'H', 'in-progress', ['A1', 'A2']),                // A1 overdue + A2 blocked
    item('E2', 'H', 'planned', ['B1'], '2026-10-01'),            // due soon, nothing started
    item('E3', 'H', 'planned', [], '2026-10-01'),                // due soon, no tasks
    item('E4', 'H', 'done', ['C1']),                             // done epic: never at risk
    item('E5', 'H', 'in-progress', ['D1', 'D2']),                // overdue task done, cancelled one ignored
    item('E6', 'H', 'in-progress', ['F1'], '2026-10-01'),        // due soon but started
    item('E7', 'H', 'planned', ['G1'], '2026-09-20'),            // overdue epic: 'overdue', not 'no progress'
  ], {
    A1: st('todo', '2026-09-27'), A2: st('blocked'), B1: st('todo'), C1: st('blocked', '2026-01-01'),
    D1: st('done', '2026-09-01'), D2: st('cancelled', '2026-09-01'), F1: st('in-progress'), G1: st('todo'),
  }, TODAY).drift
  const atRisk = (id: string) => risk.filter(d => d.id === id && d.kind === 'at-risk')
  assert.equal(atRisk('E1').length, 1)
  assert.equal(atRisk('E1')[0].message, 'E1 "E1" at risk: A1 overdue since 2026-09-27; A2 blocked')
  assert.equal(atRisk('E1')[0].suggestedStatus, undefined)
  assert.ok(atRisk('E2')[0]?.message.includes('due 2026-10-01, nothing started'))
  assert.equal(atRisk('E3').length, 1)
  for (const id of ['E4', 'E5', 'E6', 'E7', 'H']) assert.equal(atRisk(id).length, 0, `${id} not at risk`)
  assert.ok(risk.find(d => d.id === 'E7' && d.kind === 'overdue'))
}

{
  const tasks = {
    O1: st('todo', '2026-09-20'), O2: st('blocked', '2026-09-27'), N1: st('todo', '2026-10-03'), N2: st('in-progress', '2026-10-01'),
    D1: st('done', '2026-09-01'), C1: st('cancelled', '2026-09-01'), X1: st('todo'),
  }
  assert.deepEqual(taskDueSummary(['O1', 'O2', 'N1', 'N2'], tasks, TODAY), { overdue: 2, next: '2026-10-01' })
  assert.deepEqual(taskDueSummary(['N1', 'X1'], tasks, TODAY), { overdue: 0, next: '2026-10-03' })
  assert.deepEqual(taskDueSummary(['O1'], tasks, TODAY), { overdue: 1, next: null })
  assert.deepEqual(taskDueSummary(['T001', 'N1'], { ...tasks }, '2026-10-03'), { overdue: 0, next: '2026-10-03' }, 'due today is not overdue; unknown id ignored')
  assert.equal(taskDueSummary(['D1', 'C1', 'X1'], tasks, TODAY), null)
  assert.equal(taskDueSummary([], tasks, TODAY), null)
}

// paused (R055): a paused epic with a blocked, overdue task is not at risk and gets no status nudge;
// once every task is done it is nudged to done like any other
{
  const h = roadmapHealth([
    item('H', null, 'paused'),
    item('P', 'H', 'paused', ['P1', 'P2'], '2026-09-30'),
  ], { P1: st('blocked', '2026-09-01'), P2: st('paused') }, TODAY)
  assert.deepEqual(h.drift.filter((d) => d.kind === 'at-risk' || d.kind === 'status-mismatch'), [])
  const all = roadmapHealth([item('H', null, 'in-progress'), item('P', 'H', 'paused', ['P1'])], { P1: st('done') }, TODAY)
  assert.ok(all.drift.some((d) => d.id === 'P' && d.suggestedStatus === 'done'))
}

console.log('roadmap-health: ok')
