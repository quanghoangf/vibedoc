// node src/lib/item-diagrams.check.mts
import assert from 'node:assert/strict'
import { dependencyOrder, depGraphMermaid, depIdsOf, docLinkMermaid, epicGraph, epicGraphMermaid, formatEpicMap, formatTaskDeps, taskNeighbourhood, type DiagramTask } from './item-diagrams.ts'

const T = (id: string, dependsOn = '', status = 'todo', title = `Task ${id}`): DiagramTask => ({ id, title, status, dependsOn })

assert.deepEqual(depIdsOf('T1, t2 and T1 (after T03)'), ['T1', 'T2', 'T03'])

// no deps and no dependents → nothing to draw; unknown task → nothing
assert.equal(taskNeighbourhood('T1', [T('T1'), T('T2')]), null)
assert.equal(taskNeighbourhood('T9', [T('T1')]), null)

// chain T1 → T2 → T3 → T4 seen from T3: two hops up, one down
const chain = [T('T1', '', 'done'), T('T2', 'T1', 'in-progress'), T('T3', 'T2'), T('T4', 'T3')]
const c = taskNeighbourhood('T3', chain)!
assert.deepEqual(c.nodes.map((n) => n.id), ['T3', 'T2', 'T4', 'T1'])
assert.deepEqual(c.edges, [['T2', 'T3'], ['T1', 'T2'], ['T3', 'T4']])
assert.equal(c.more, 0)
// three hops up is out of reach
assert.ok(!taskNeighbourhood('T4', chain)!.nodes.some((n) => n.id === 'T1'))

// diamond: T4 waits on T2 and T3, both on T1 → T1 once, all four edges
const d = taskNeighbourhood('T4', [T('T1'), T('T2', 'T1'), T('T3', 'T1'), T('T4', 'T2, T3')])!
assert.deepEqual(d.nodes.map((n) => n.id), ['T4', 'T2', 'T3', 'T1'])
assert.equal(d.edges.length, 4)

// a cycle doesn't loop; a self-reference is ignored
const cy = taskNeighbourhood('T1', [T('T1', 'T2, T1'), T('T2', 'T1')])!
assert.deepEqual(cy.nodes.map((n) => n.id), ['T1', 'T2'])
assert.deepEqual(cy.edges, [['T2', 'T1'], ['T1', 'T2']])

// a dependency with no task file is a node with status null
const miss = taskNeighbourhood('T1', [T('T1', 'T99')])!
assert.deepEqual(miss.nodes[1], { id: 'T99', title: '', status: null })

// cap: 20 dependents → 12 nodes, 9 more
const many = [T('T0'), ...Array.from({ length: 20 }, (_, i) => T(`T${i + 1}`, 'T0'))]
const m = taskNeighbourhood('T0', many)!
assert.equal(m.nodes.length, 12)
assert.equal(m.more, 9)
assert.equal(m.edges.length, 11)

// mermaid: glyph + id + title, focus = accent, statuses as classes, missing dashed, titles escaped and cut
const src = depGraphMermaid(taskNeighbourhood('T2', [T('T1', '', 'done', 'Say "hi" <b>'), T('T2', 'T1, T99', 'review'), T('T3', 'T2', 'todo', 'x'.repeat(40))])!, 'T2')
assert.equal(src, [
  'flowchart LR',
  '  T2["◑ T2 · Task T2"]',
  '  T1["✓ T1 · Say #quot;hi#quot; #lt;b#gt;"]',
  '  T99["T99 · ?"]',
  `  T3["○ T3 · ${'x'.repeat(31)}…"]`,
  '  T1 --> T2',
  '  T99 --> T2',
  '  T2 --> T3',
  '  class T2 accent',
  '  class T1 st-done',
  '  class T99 st-missing',
  '  class T3 st-todo',
].join('\n'))
assert.match(depGraphMermaid(m, 'T0'), /\n {2}more\["\+9 more"\]\n {2}T0 -\.- more\n/)

// epic: tasks in the epic only (cancelled + missing dropped), deps inside the epic, coverage edges, uncovered scenario
const E = (id: string, dependsOn: string, status: string, covers: string[]) => ({ id, title: `Task ${id}`, status, dependsOn, covers })
const eg = epicGraph(['T1', 'T2', 'T3', 'T4', 'T9'], [
  E('T1', '', 'done', ['S1']), E('T2', 'T1, T50', 'in-progress', ['S1', 'S2', 'S7']), E('T3', 'T2', 'cancelled', ['S3']), E('T4', '', 'todo', []), E('T50', '', 'done', []),
], [{ id: 'S1', name: 'Login', status: 'passed' }, { id: 'S2', name: 'Logout', status: 'unproven' }, { id: 'S3', name: 'Reset', status: 'failed' }])
assert.deepEqual(eg.tasks.map((t) => t.id), ['T1', 'T2', 'T4'])
assert.deepEqual(eg.deps, [['T1', 'T2']], 'T50 is outside the epic')
assert.deepEqual(eg.covers, [['T1', 'S1'], ['T2', 'S1'], ['T2', 'S2']], 'S7 is not a scenario of the epic')
assert.deepEqual(eg.scenarios.map((s) => s.covered), [true, true, false], 'S3 only covered by a cancelled task')
const esrc = epicGraphMermaid(eg)
assert.equal(esrc, [
  'flowchart TB',
  '  T1["✓ T1 · Task T1"]',
  '  T2["◐ T2 · Task T2"]',
  '  T4["○ T4 · Task T4"]',
  '  S1(["✓ S1 · Login"])',
  '  S2(["? S2 · Logout"])',
  '  S3(["✕ S3 · Reset"])',
  '  T1 --> T2',
  '  T1 -.-> S1',
  '  T2 -.-> S1',
  '  T2 -.-> S2',
  '  class T1 st-done',
  '  class T2 st-in-progress',
  '  class T4 st-todo',
  '  class S1 sc-passed',
  '  class S2 sc-unproven',
  '  class S3 sc-uncovered',
].join('\n'))
// no scenarios → tasks only
assert.doesNotMatch(epicGraphMermaid(epicGraph(['T1'], [E('T1', '', 'todo', [])], [])), /S\d/)

// doc links: in left, out right (both = <-->), broken dashed and not clickable, ids for items, short labels
const lf = (path: string, direction: 'in' | 'out' | 'both', id = path, label = path) => ({ path, label, id, direction })
const dl = docLinkMermaid('HLD', [lf('docs/a.md', 'in', 'docs/a.md', 'Overview of the whole system'), lf('plans/tasks/T001-x.md', 'out', 'T001', 'Do it'), lf('docs/c.md', 'both', 'docs/c.md', 'C')], ['docs/gone/missing.md'])
assert.equal(dl.source, [
  'flowchart TB',
  '  self["HLD"]',
  '  in0["Overview of the who…"] --> self',
  '  self --> out0["T001 · Do it"]',
  '  self <--> out1["C"]',
  '  self -.-> broken0["missing.md"]',
  '  class broken0 st-missing',
  '  class self accent',
].join('\n'))
assert.deepEqual(dl.targets, { in0: 'docs/a.md', out0: 'plans/tasks/T001-x.md', out1: 'docs/c.md' })
// cap per side → "+N more" nodes that go to the graph
const manyLinks = docLinkMermaid('X', Array.from({ length: 11 }, (_, i) => lf(`d${i}.md`, i < 10 ? 'in' : 'out')), ['b1.md', 'b2.md'], 8)
assert.match(manyLinks.source, /morein\["\+2 more"\] -\.- self/)
assert.doesNotMatch(manyLinks.source, /moreout/, '1 out + 2 broken fit in 8')
assert.equal(manyLinks.targets.morein, 'more')
assert.equal(Object.keys(manyLinks.targets).filter((k) => k.startsWith('in')).length, 8)

// MCP text: get_task's ## Dependencies (both sides, statuses, missing files), nothing without links
const tt = [T('T1', '', 'done', 'One'), T('T2', 'T1, T99', 'review', 'Two'), T('T3', 'T2', 'todo', 'Three'), T('T4')]
assert.equal(formatTaskDeps('T2', tt), '## Dependencies\nWaits on: T1 ✓ done (One) · T99 (no task file)\nBlocks: T3 ○ todo (Three)')
assert.equal(formatTaskDeps('T3', tt), '## Dependencies\nWaits on: T2 ◑ review (Two)')
assert.equal(formatTaskDeps('T4', tt), '')
assert.equal(formatTaskDeps('T9', tt), '')

// epic map text: dependency order (T3 listed first in the epic but waits on T1), covers, scenarios, uncovered
const og = epicGraph(['T3', 'T1', 'T2'], [E('T1', '', 'done', ['S1']), E('T2', '', 'todo', []), E('T3', 'T1', 'in-progress', ['S1', 'S2'])],
  [{ id: 'S1', name: 'Login', status: 'passed' }, { id: 'S2', name: 'Logout', status: 'unproven' }, { id: 'S3', name: 'Reset', status: 'unproven' }])
assert.deepEqual(dependencyOrder(og).map((t) => t.id), ['T1', 'T3', 'T2'])
assert.equal(formatEpicMap(og), [
  'Tasks (dependency order):',
  '- ✓ T1 Task T1 — done · covers S1',
  '- ◐ T3 Task T3 — in-progress · after T1 · covers S1, S2',
  '- ○ T2 Task T2 — todo',
  'Scenarios: ✓ S1 Login — passed · ? S2 Logout — unproven · ? S3 Reset — unproven',
  'Not covered by any task: S3',
].join('\n'))
// a cycle still lists every task once
assert.equal(dependencyOrder(epicGraph(['T1', 'T2'], [E('T1', 'T2', 'todo', []), E('T2', 'T1', 'todo', [])], [])).length, 2)
assert.equal(formatEpicMap(epicGraph([], [], [])), 'No tasks yet.')

console.log('item-diagrams: ok')
