// Self-check for board views. Run: node src/lib/board-views.check.mts
import assert from 'node:assert/strict'
import type { ActivityEvent, Task } from './core'
import {
  DEFAULT_VIEWS, applyView, defaultView, depOutline, epicOf, foldAxis, fromParams, groupTasks, isDirty, isReady, sizeOf, sortLanes, taskKey, timelineBars, toParams,
  type ViewState,
} from './board-views.ts'

const task = (id: string, o: Partial<Task> = {}): Task =>
  ({ id, title: `Task ${id}`, status: 'todo', size: 'M (2–3 hrs)', phase: '', dependsOn: '—', owner: null, due: null, manualTests: null, file: `${id}.md`, ...o })
const ids = (ts: { id: string }[]) => ts.map((t) => t.id)
const ctx = { agentTasks: new Set(['T3']) }
const view = (o: Partial<ViewState> = {}): ViewState => ({ ...defaultView('table'), sorts: [], ...o })

// fields
assert.deepEqual(epicOf('R043 — Task verification & review'), { id: 'R043', title: 'Task verification & review' })
assert.deepEqual(epicOf('UI Polish'), { id: null, title: 'UI Polish' })
assert.equal(sizeOf(task('T1', { size: 'M (2–3 hrs)' })), 'M')
assert.equal(sizeOf(task('T1', { size: 'XL' })), 'XL')
assert.equal(sizeOf(task('T1', { size: '—' })), null)
assert.equal(sizeOf(task('T1', { size: '' })), null)

// ready
const done = task('T1', { status: 'done' })
const t2 = task('T2', { dependsOn: 'T1' })
const t3 = task('T3', { dependsOn: 'T1, T2 (after)' })
const byId = new Map([done, t2, t3].map((t) => [t.id, t]))
assert.equal(isReady(t2, byId), true)
assert.equal(isReady(t3, byId), false)                                    // T2 not done
assert.equal(isReady(task('T9', { dependsOn: 'T404' }), byId), false)     // unknown dep is not done
assert.equal(isReady(done, byId), false)                                  // only todo

// applyView: filters, q, cancelled, sort
const tasks = [
  task('T10', { status: 'in-progress', phase: 'R043 — Review', size: 'S', due: '2026-10-01' }),
  task('T2', { status: 'done', phase: 'R043 — Review', manualTests: { total: 2, done: 1 } }),
  task('T3', { status: 'todo', phase: 'R040 — Planning', dependsOn: 'T2', size: 'XS' }),
  task('T4', { status: 'cancelled', phase: 'R040 — Planning' }),
  task('T11', { status: 'review', title: 'Fix the Board', due: '2026-09-01', size: '—' }),
]
assert.deepEqual(ids(applyView(tasks, view(), ctx)), ['T2', 'T3', 'T10', 'T11'])       // id numeric, cancelled hidden
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'status', op: 'is', value: ['cancelled'] }] }), ctx)), ['T4'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'status', op: 'is-not', value: ['done', 'cancelled'] }] }), ctx)), ['T3', 'T10', 'T11'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'epic', op: 'is', value: ['R043', 'none'] }] }), ctx)), ['T2', 'T10', 'T11'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'size', op: 'is', value: ['XS', 'S'] }] }), ctx)), ['T3', 'T10'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'due', op: 'before', value: ['2026-09-15'] }] }), ctx)), ['T11'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'due', op: 'not-set', value: [] }] }), ctx)), ['T2', 'T3'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'deps', op: 'is-set', value: [] }] }), ctx)), ['T3'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'tests', op: 'is-set', value: [] }] }), ctx)), ['T2'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'agent', op: 'is-set', value: [] }] }), ctx)), ['T3'])
assert.deepEqual(ids(applyView(tasks, view({ filters: [{ prop: 'ready', op: 'is-set', value: [] }] }), ctx)), ['T3'])
assert.deepEqual(ids(applyView(tasks, view({ q: 'board' }), ctx)), ['T11'])
assert.deepEqual(ids(applyView(tasks, view({ q: 't1' }), ctx)), ['T10', 'T11'])
assert.deepEqual(ids(applyView(tasks, defaultView('table'), ctx)), ['T10', 'T11', 'T3', 'T2'])           // status workflow order
assert.deepEqual(ids(applyView(tasks, view({ sorts: [{ prop: 'id', dir: 'desc' }] }), ctx)), ['T11', 'T10', 'T3', 'T2'])
assert.deepEqual(ids(applyView(tasks, view({ sorts: [{ prop: 'size', dir: 'asc' }] }), ctx)), ['T3', 'T10', 'T2', 'T11'])
assert.deepEqual(ids(applyView(tasks, view({ sorts: [{ prop: 'due', dir: 'asc' }] }), ctx)), ['T11', 'T10', 'T2', 'T3'])
assert.deepEqual(ids(applyView(tasks, view({ sorts: [{ prop: 'due', dir: 'desc' }] }), ctx)), ['T10', 'T11', 'T2', 'T3'])  // nulls stay last

// groupTasks
const g = (ts: Task[], by: Parameters<typeof groupTasks>[1]) => groupTasks(ts, by).map((x) => [x.key, x.label, ids(x.tasks).join()])
assert.deepEqual(g(tasks, 'status'), [
  ['in-progress', 'In progress', 'T10'], ['review', 'Review', 'T11'], ['todo', 'Todo', 'T3'], ['done', 'Done', 'T2'], ['cancelled', 'Cancelled', 'T4'],
])
const epics = [
  task('T1', { phase: 'R010 — Old', status: 'done' }),
  task('T2', { phase: 'R012 — Newer done', status: 'done' }),
  task('T5', { phase: 'R020 — Busy' }),
  task('T3', { phase: 'R030 — Busier' }),
  task('T4', { phase: 'Loose' }),
]
assert.deepEqual(g(epics, 'epic'), [['R030', 'Busier', 'T3'], ['R020', 'Busy', 'T5'], ['R012', 'Newer done', 'T2'], ['R010', 'Old', 'T1'], ['none', 'No epic', 'T4']])
assert.equal(groupTasks(epics, 'epic')[0].epicId, 'R030')
assert.equal(groupTasks(epics, 'epic')[4].epicId, null)
assert.deepEqual(g(tasks, 'size'), [['XS', 'XS', 'T3'], ['S', 'S', 'T10'], ['M', 'M', 'T2,T4'], ['none', 'No size', 'T11']])
assert.deepEqual(g(tasks, 'none'), [['all', 'All tasks', ids(tasks).join()]])
assert.deepEqual(groupTasks([], 'epic'), [])

// depOutline
const chain = [
  task('T1'), task('T2', { dependsOn: 'T1' }), task('T3', { dependsOn: 'T2, T1, T99' }), task('T4', { dependsOn: 'T3' }),
  task('T5', { dependsOn: 'T4' }), task('T6', { dependsOn: 'T5' }), task('T7'),
]
assert.deepEqual(depOutline(chain).map((r) => [r.task.id, r.depth, r.alsoAfter.join()]), [
  ['T1', 0, ''], ['T2', 1, ''], ['T3', 2, 'T1,T99'], ['T4', 3, ''], ['T5', 4, ''], ['T6', 4, ''], ['T7', 0, ''],
])
const cycle = depOutline([task('T1', { dependsOn: 'T2' }), task('T2', { dependsOn: 'T1' }), task('T3', { dependsOn: 'T3' })])
assert.deepEqual(cycle.map((r) => [r.task.id, r.depth]), [['T3', 0], ['T1', 0], ['T2', 1]])

// timelineBars
const at = (min: number) => new Date(Date.UTC(2026, 8, 29, 9, min)).toISOString()
const ev = (taskId: string, min: number, taskStatus?: Task['status'], type: ActivityEvent['type'] = 'task_updated'): ActivityEvent =>
  ({ id: `${taskId}-${min}`, timestamp: at(min), type, actor: 'ai', title: '', taskId, taskStatus })
const now = Date.parse(at(100))
const events = [
  ev('T1', 30, 'done'), ev('T1', 5, 'todo'), ev('T1', 10, 'in-progress'), ev('T1', 20, 'done'),
  ev('T2', 40), ev('T2', 50, 'in-progress', 'doc_read'),
  ev('T4', 60, 'review'),
]
const bars = timelineBars([task('T1', { status: 'done', phase: 'R043 — X' }), task('T2', { status: 'in-progress' }), task('T3'), task('T4', { status: 'review' })], events, now)
assert.deepEqual(bars.map((b) => [b.taskId, b.epicId, b.startMs, b.endMs, b.open]), [
  ['T1', 'R043', Date.parse(at(10)), Date.parse(at(30)), false],
  ['T2', null, Date.parse(at(40)), now, true],                 // fallback start = first event; open ends now
  ['T4', null, Date.parse(at(60)), now, true],
])                                                             // T3 has no events → skipped

// foldAxis
const MIN = 60_000, H = 60 * MIN
const bar = (s: number, e: number) => ({ taskId: 'T', epicId: null, startMs: s, endMs: e, status: 'done' as const, open: false })
assert.deepEqual(foldAxis([bar(10 * H, 30 * H), bar(0, 2 * MIN)], H), [{ startMs: -MIN, endMs: 3 * MIN }, { startMs: 9 * H, endMs: 31 * H }])
assert.deepEqual(foldAxis([bar(0, 10 * MIN), bar(15 * MIN, 20 * MIN)], H), [{ startMs: -MIN, endMs: 21 * MIN }])
assert.deepEqual(foldAxis([], H), [])

// params round-trip
for (const v of DEFAULT_VIEWS) {
  assert.deepEqual(fromParams(toParams(v)), defaultView(v.kind))
  assert.equal(isDirty(defaultView(v.kind), v), false)
}
assert.deepEqual(DEFAULT_VIEWS.map((v) => [v.id, v.name]), [['board', 'Board'], ['table', 'Table'], ['epic', 'By epic'], ['timeline', 'Timeline']])
assert.equal(toParams(defaultView('board')).toString(), '')
assert.equal(toParams(defaultView('table')).toString(), 'view=table')
const custom: ViewState = {
  kind: 'table', group: 'status', subGroup: 'size', q: 'a;b:c|d', scale: 'week', properties: ['due', 'status'],
  sorts: [{ prop: 'status', dir: 'asc' }, { prop: 'id', dir: 'desc' }],
  filters: [
    { prop: 'status', op: 'is-not', value: ['done', 'cancelled'] }, { prop: 'epic', op: 'is', value: ['R043'] },
    { prop: 'deps', op: 'is-set', value: [] }, { prop: 'size', op: 'is', value: ['a|b;c:d', ''] },
  ],
}
const p = toParams(custom)
assert.equal(p.get('s'), 'status,-id')
assert.equal(p.get('f')?.startsWith('status:is-not:done|cancelled;epic:is:R043;deps:is-set;'), true)
assert.deepEqual(fromParams(new URLSearchParams(p.toString())), custom)
const empty: ViewState = { ...defaultView('table'), sorts: [], properties: [] }
assert.deepEqual(fromParams(toParams(empty)), empty)
assert.equal(isDirty({ ...defaultView('epic'), q: 'x' }, DEFAULT_VIEWS[2]), false)                 // ignores q
assert.equal(isDirty({ ...defaultView('epic'), group: 'size' }, DEFAULT_VIEWS[2]), true)
// unknown values fall back
assert.deepEqual(fromParams(new URLSearchParams('view=nope&g=bad&sc=year&f=zzz:is:x;status:bogus:x&s=nope,-id&p=due,wat')),
  { ...defaultView('board'), sorts: [{ prop: 'id', dir: 'desc' }], properties: ['due'] })

// owner (R055): filter by kind, group human → agents → none, survives the URL
{
  const ts = [task('T1', { owner: 'ai:claude' }), task('T2', { owner: 'human' }), task('T3'), task('T4', { owner: 'ai:cursor' })]
  assert.deepEqual(ids(applyView(ts, view({ filters: [{ prop: 'owner', op: 'is', value: ['ai'] }] }), ctx)), ['T1', 'T4'])
  assert.deepEqual(ids(applyView(ts, view({ filters: [{ prop: 'owner', op: 'is', value: ['none'] }] }), ctx)), ['T3'])
  assert.deepEqual(ids(applyView(ts, view({ filters: [{ prop: 'owner', op: 'is-not', value: ['human'] }] }), ctx)), ['T1', 'T3', 'T4'])
  assert.deepEqual(groupTasks(ts, 'owner').map((g) => [g.key, g.label]), [['human', 'Human'], ['ai:claude', 'claude (AI)'], ['ai:cursor', 'cursor (AI)'], ['none', 'No owner']])
  const st = view({ group: 'owner', filters: [{ prop: 'owner', op: 'is', value: ['ai', 'human'] }] })
  const back = fromParams(toParams(st))
  assert.equal(back.group, 'owner')
  assert.deepEqual(back.filters, st.filters)
}

// custom statuses (R055): filter and group by the custom id, in the project's order
{
  const ts = [task('T1', { status: 'review', customStatus: 'qa' }), task('T2', { status: 'review' }), task('T3')]
  assert.deepEqual(ids(applyView(ts, view({ filters: [{ prop: 'status', op: 'is', value: ['qa'] }] }), ctx)), ['T1'])
  const order = [{ id: 'todo', label: 'Backlog' }, { id: 'qa', label: 'QA' }, { id: 'review', label: 'Review' }]
  assert.deepEqual(groupTasks(ts, 'status', order).map((g) => [g.key, g.label]), [['todo', 'Backlog'], ['qa', 'QA'], ['review', 'Review']])
  assert.deepEqual(groupTasks([task('T2', { status: 'review' })], 'status').map((g) => g.key), ['review'], 'no custom statuses: as before')
}

// R102 group board: tasks carry their repo; ids (and epic ids) repeat across repos
{
  const web = { id: 'web', name: 'Web' }, api = { id: 'api', name: 'Api' }
  const ts = [
    ...[1, 2, 3, 4, 5].map((n) => task(`T00${n}`, { project: web, phase: 'R002 — Web epic' })),
    task('T001', { project: api, phase: 'R002 — Api epic' }),
    task('T002', { project: api, phase: 'R002 — Api epic', dependsOn: 'T001' }),
    task('T003', { project: api, status: 'done', phase: 'R002 — Api epic' }),
    task('T009', { project: api, dependsOn: 'T003' }),
  ]
  assert.equal(taskKey(task('T1')), 'T1', 'no repo: the key is the id')
  assert.equal(taskKey(ts[5]), 'api:T001')
  assert.equal(new Set(ts.map(taskKey)).size, ts.length, 'both T001s keep their own key')
  const shown = applyView(ts, view(), ctx)
  assert.equal(shown.length, 9, 'all tasks of both repos show')
  assert.deepEqual(shown.filter((t) => t.id === 'T001').map((t) => t.project?.id).sort(), ['api', 'web'])
  // repo filter
  const onlyApi = applyView(ts, view({ filters: [{ prop: 'repo', op: 'is', value: ['api'] }] }), ctx)
  assert.deepEqual(onlyApi.map(taskKey), ['api:T001', 'api:T002', 'api:T003', 'api:T009'])
  assert.equal(applyView(ts, view({ filters: [{ prop: 'repo', op: 'is-not', value: ['api'] }] }), ctx).length, 5)
  assert.equal(applyView([task('T1')], view({ filters: [{ prop: 'repo', op: 'is', value: ['none'] }] }), ctx).length, 1)
  // deps resolve inside the task's own repo: api T009 waits on api T003 (done), not web T003 (todo)
  const ready = applyView(ts, view({ filters: [{ prop: 'ready', op: 'is-set', value: [] }] }), ctx)
  assert.ok(ready.some((t) => taskKey(t) === 'api:T009'))
  assert.ok(!ready.some((t) => taskKey(t) === 'api:T002'), 'api T002 waits on api T001 (todo)')
  // group by repo, by epic (one bucket per repo's R002)
  assert.deepEqual(groupTasks(ts, 'repo').map((g) => [g.key, g.label, g.tasks.length]), [['api', 'Api', 4], ['web', 'Web', 5]])
  assert.deepEqual(groupTasks(ts, 'epic').map((g) => [g.key, g.label, g.epicId]).sort(), [
    ['api:R002', 'Api · Api epic', 'R002'], ['none', 'No epic', null], ['web:R002', 'Web · Web epic', 'R002'],
  ].sort())
  // the dependency outline nests within a repo, never across
  const outline = depOutline(ts)
  assert.equal(outline.length, ts.length)
  assert.equal(outline.find((o) => taskKey(o.task) === 'api:T002')?.depth, 1)
  assert.equal(outline.find((o) => taskKey(o.task) === 'web:T002')?.depth, 0)
  // URL codec keeps the repo filter / lanes / sections
  const st = view({ group: 'repo', subGroup: 'repo', filters: [{ prop: 'repo', op: 'is', value: ['api'] }] })
  assert.deepEqual(fromParams(toParams(st)), st)
}

// sortLanes: review / in-progress lanes first, then todo, then paused/done-only lanes; ties keep their order
{
  const lane = (key: string, ...st: Task['status'][]) => ({ key, tasks: st.map((status, i) => task(`${key}${i}`, { status })) })
  const order = sortLanes([lane('P', 'paused', 'done'), lane('A', 'todo'), lane('B', 'done', 'review'), lane('D', 'done'), lane('C', 'in-progress'), lane('E', 'blocked')])
  assert.deepEqual(order.map((l) => l.key), ['B', 'C', 'A', 'E', 'P', 'D'])
}

console.log('board-views: ok')
