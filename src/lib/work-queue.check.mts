// Self-check for work-queue. Run: node src/lib/work-queue.check.mts
import assert from 'node:assert/strict'
import type { RoadmapItem } from './core'
import { depIds, pickNextTask, type QueueTask } from './work-queue.ts'

const epic = (tasks: string[]): RoadmapItem =>
  ({ id: 'R002', title: 'Epic', parent: 'R001', status: 'planned', order: 10, tasks, due: null, body: '', file: 'R002.md' })
const t = (id: string, status: QueueTask['status'], dependsOn = '—'): QueueTask => ({ id, status, dependsOn })

// depIds: free text, case, dedupe, none
assert.deepEqual(depIds('T008, T009 (wizard skeleton must exist)'), ['T008', 'T009'])
assert.deepEqual(depIds('t028 (needs T028 first)'), ['T028'])
assert.deepEqual(depIds('—'), [])
assert.deepEqual(depIds(''), [])

// order: first ready in epic.tasks order, not file order
assert.deepEqual(pickNextTask(epic(['T002', 'T001']), [t('T001', 'todo'), t('T002', 'todo')]), { kind: 'ready', taskId: 'T002' })

// unmet dependency: T002 waits on T001 (in-progress, not handed out) → waiting
assert.deepEqual(pickNextTask(epic(['T001', 'T002']), [t('T001', 'in-progress'), t('T002', 'todo', 'T001')]), { kind: 'waiting', needsHuman: false, waiting: [
  { taskId: 'T001', reason: 'T001 is in progress (claimed)' },
  { taskId: 'T002', reason: 'T002 waits on T001 (in-progress)' },
] })

// met dependency → ready
assert.deepEqual(pickNextTask(epic(['T001', 'T002']), [t('T001', 'done'), t('T002', 'todo', 'T001')]), { kind: 'ready', taskId: 'T002' })

// cancelled dependency counts as met
assert.deepEqual(pickNextTask(epic(['T001', 'T002']), [t('T001', 'cancelled'), t('T002', 'todo', 'T001')]), { kind: 'ready', taskId: 'T002' })

// missing dependency file counts as NOT met
assert.deepEqual(pickNextTask(epic(['T002']), [t('T002', 'todo', 'T099')]), { kind: 'waiting', needsHuman: true, waiting: [
  { taskId: 'T002', reason: 'T002 waits on T099 (missing)' },
] })

// dependency outside the epic still honoured; an idle todo outside the epic is never handed out → needs a human
assert.deepEqual(pickNextTask(epic(['T002']), [t('T001', 'todo'), t('T002', 'todo', 'T001')]), { kind: 'waiting', needsHuman: true, waiting: [
  { taskId: 'T002', reason: 'T002 waits on T001 (todo)' },
] })

// blocked / in-progress never handed out
assert.deepEqual(pickNextTask(epic(['T001', 'T002']), [t('T001', 'blocked'), t('T002', 'in-progress')]), { kind: 'waiting', needsHuman: false, waiting: [
  { taskId: 'T001', reason: 'T001 is blocked' },
  { taskId: 'T002', reason: 'T002 is in progress (claimed)' },
] })

// finished: all existing linked tasks settled; missing linked ids ignored
assert.deepEqual(pickNextTask(epic(['T001', 'T002', 'T404']), [t('T001', 'done'), t('T002', 'cancelled')]), { kind: 'finished' })
assert.deepEqual(pickNextTask(epic([]), []), { kind: 'finished' })

// reasons: missing task file, mixed deps, done/cancelled skipped, epic order
assert.deepEqual(pickNextTask(epic(['T003', 'T040', 'T001', 'T002']), [
  t('T001', 'done'), t('T002', 'cancelled'), t('T031', 'in-progress'), t('T003', 'todo', 'T031, T099 (x), T001'),
]), { kind: 'waiting', needsHuman: true, waiting: [  // T099 missing → T003 can't move either
  { taskId: 'T003', reason: 'T003 waits on T031 (in-progress), T099 (missing)' },
  { taskId: 'T040', reason: 'T040 has no task file' },
] })

const needsHuman = (r: ReturnType<typeof pickNextTask>) => r.kind === 'waiting' && r.needsHuman

// needs a human: chain T003 → T002 → T001 (blocked), nothing in progress
assert.equal(needsHuman(pickNextTask(epic(['T001', 'T002', 'T003']), [
  t('T001', 'blocked'), t('T002', 'todo', 'T001'), t('T003', 'todo', 'T002'),
])), true)

// dependency cycle → stuck
assert.equal(needsHuman(pickNextTask(epic(['T001', 'T002']), [t('T001', 'todo', 'T002'), t('T002', 'todo', 'T001')])), true)

// only a linked id with no file left → finished ignores it
assert.deepEqual(pickNextTask(epic(['T001', 'T404']), [t('T001', 'done')]), { kind: 'finished' })

// review (R043): not a met dependency, blocks finished, and only a human can move it
assert.deepEqual(pickNextTask(epic(['T001', 'T002']), [t('T001', 'review'), t('T002', 'todo', 'T001')]), { kind: 'waiting', needsHuman: true, waiting: [
  { taskId: 'T001', reason: 'T001 in review — needs a human' },
  { taskId: 'T002', reason: 'T002 waits on T001 (review)' },
] })
assert.deepEqual(pickNextTask(epic(['T001', 'T002']), [t('T001', 'done'), t('T002', 'review')]), { kind: 'waiting', needsHuman: true, waiting: [
  { taskId: 'T002', reason: 'T002 in review — needs a human' },
] }, 'review + done is not finished')
// review elsewhere doesn't hide a ready task
assert.deepEqual(pickNextTask(epic(['T001', 'T002']), [t('T001', 'review'), t('T002', 'todo')]), { kind: 'ready', taskId: 'T002' })
// a sent-back task is just todo again: handed out like any other
assert.deepEqual(pickNextTask(epic(['T001']), [t('T001', 'todo')]), { kind: 'ready', taskId: 'T001' })

// paused (R055): never handed out, not a met dependency, and only a human can resume it
{
  const r = pickNextTask(epic(['T001', 'T002']), [t('T001', 'paused'), t('T002', 'todo', 'T001')])
  assert.equal(r.kind, 'waiting')
  if (r.kind === 'waiting') {
    assert.equal(r.needsHuman, true)
    assert.ok(r.waiting.some((w) => w.reason.includes('T001 is paused')))
  }
}

console.log('work-queue: ok')
