// Self-check for memory-graph. Run: node src/lib/memory-graph.check.mts
import assert from 'node:assert/strict'
import { buildGraph, extractRefs, fileNode, neighbourhood, type GraphItem } from './memory-graph.ts'

// extractRefs: id patterns, padding, whole tokens only
assert.deepEqual(extractRefs('See T065, R048 and ADR-4; also E12 and E001.').ids, ['T065', 'R048', 'ADR-004', 'E012', 'E001'])
assert.deepEqual(extractRefs('XT0651 T0651a e2e E2E ET065 abcR048 R04 T12 E0').ids, [])
assert.deepEqual(extractRefs('(T065) [R048] `E3` T065.').ids, ['T065', 'R048', 'E003'])
assert.deepEqual(extractRefs('T065 again T065').ids, ['T065'])

// extractRefs: .md paths in backticks and as link targets; no bare words, no URLs
assert.deepEqual(extractRefs('Read `docs/architecture/HLD.md` and [map](./docs/DOMAIN_MAP.md#data) or [x](<docs/a b.md>).').paths,
  ['docs/architecture/HLD.md', 'docs/DOMAIN_MAP.md'])
assert.deepEqual(extractRefs('plain docs/HLD.md and [site](https://x.dev/README.md) and `not a path`').paths, [])
assert.deepEqual(extractRefs('`README.md` [r](README.md)').paths, ['README.md'])

// fileNode: kinds by path, labels from the H1
assert.deepEqual(fileNode('plans/tasks/T065-recall.md', '# T065: vibedoc_recall\n'), { id: 'T065', kind: 'task', label: 'vibedoc_recall', path: 'plans/tasks/T065-recall.md' })
assert.deepEqual(fileNode('plans/roadmap/R048-x.md', '# R048: Token-cheap recall\n'), { id: 'R048', kind: 'epic', label: 'Token-cheap recall', path: 'plans/roadmap/R048-x.md' })
assert.deepEqual(fileNode('docs/architecture/decisions/ADR-004-mcp.md', '# ADR-004: Hand-rolled MCP\n'), { id: 'ADR-004', kind: 'adr', label: 'Hand-rolled MCP', path: 'docs/architecture/decisions/ADR-004-mcp.md' })
assert.deepEqual(fileNode('docs/HLD.md', '# High-Level Design\n'), { id: 'docs/HLD.md', kind: 'doc', label: 'High-Level Design', path: 'docs/HLD.md' })
assert.equal(fileNode('notes.md', 'no heading').label, 'notes')

// buildGraph
const item = (id: string, kind: GraphItem['kind'], path: string, text = ''): GraphItem => ({ id, kind, label: id, path, text })
const entries = [
  item('E001', 'entry', 'memory/entries/E001-a.md', 'See T065, R048 and `docs/architecture/HLD.md`. Also T999 and E001 and [gone](docs/missing.md). T065 twice.'),
  item('E002', 'entry', 'memory/entries/E002-b.md', 'Relates to E001.'),
  item('E003', 'entry', 'memory/entries/E003-c.md', 'Nothing linked.'),
]
const others = [
  item('T065', 'task', 'plans/tasks/T065-x.md', 'Uses E002 and E999 and T066.'),
  item('T066', 'task', 'plans/tasks/T066-y.md', 'Mentions T065 only.'),
  item('R048', 'epic', 'plans/roadmap/R048-z.md'),
  item('docs/architecture/HLD.md', 'doc', 'docs/architecture/HLD.md', 'Talks about E001.'),
  item('docs/other.md', 'doc', 'docs/other.md', 'Unrelated, links `docs/architecture/HLD.md`.'),
]
const g = buildGraph(entries, others)
const has = (from: string, to: string) => g.edges.some(e => e.from === from && e.to === to)
// entry body → 3 edges to existing nodes (T065, R048, HLD doc); unresolved T999 / missing doc and the self-link dropped; duplicates removed
assert.ok(has('E001', 'T065') && has('E001', 'R048') && has('E001', 'docs/architecture/HLD.md'))
assert.equal(g.edges.filter(e => e.from === 'E001').length, 3)
assert.ok(has('E002', 'E001'))
// incoming: a task / doc mentioning an entry id; an unknown entry id is dropped; no doc-to-doc or task-to-task edges
assert.ok(has('T065', 'E002') && has('docs/architecture/HLD.md', 'E001'))
assert.ok(!g.edges.some(e => e.from === 'T065' && e.to === 'T066'))
assert.ok(!g.edges.some(e => e.from === 'docs/other.md'))
assert.equal(g.edges.length, 6)
// nodes: every entry (E003 with no links too) + only the others that touch an entry; no text field
assert.deepEqual(g.nodes.map(n => n.id).sort(), ['E001', 'E002', 'E003', 'R048', 'T065', 'docs/architecture/HLD.md'].sort())
assert.ok(g.nodes.every(n => !('text' in n)))

// neighbourhood
const n1 = neighbourhood(g, 'E001')
assert.deepEqual(n1.nodes.map(n => n.id).sort(), ['E001', 'E002', 'R048', 'T065', 'docs/architecture/HLD.md'].sort())
assert.equal(n1.edges.length, 5)
assert.deepEqual(neighbourhood(g, 'E003'), { nodes: [g.nodes.find(n => n.id === 'E003')], edges: [] })
assert.deepEqual(neighbourhood(g, 'E404'), { nodes: [], edges: [] })

console.log('memory-graph: ok')
