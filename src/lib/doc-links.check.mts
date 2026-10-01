// Self-check for doc-links. Run: node src/lib/doc-links.check.mts
import assert from 'node:assert/strict'
import { buildDocGraph, docLinks, docNode, extractLinks, resolveLink, type DocItem } from './doc-links.ts'

// extractLinks: every kind, line numbers, link text
const raw = [
  '# Title',
  'See [y](../b/y.md#part) and [[HLD]], [[HLD#flows|the design]] and `docs/x.md`.',
  'Ids: T093, R056, ADR-4, E12; not XT0651, e2e, E0.',
  '```',
  '[fenced](z.md) [[Fenced]] `f.md` T100',
  '```',
  '[site](https://x.dev/README.md) [m](mailto:a@b.md) [[https://x.dev/a]]',
].join('\n')
assert.deepEqual(extractLinks(raw, 'docs/a/x.md'), [
  { target: '../b/y.md', kind: 'md', line: 2, text: 'y' },
  { target: 'HLD', kind: 'wiki', line: 2, text: 'HLD' },
  { target: 'HLD', kind: 'wiki', line: 2, text: 'the design' },
  { target: 'docs/x.md', kind: 'code', line: 2, text: 'docs/x.md' },
  { target: 'T093', kind: 'id', line: 3, text: 'T093' },
  { target: 'R056', kind: 'id', line: 3, text: 'R056' },
  { target: 'ADR-004', kind: 'id', line: 3, text: 'ADR-4' },
  { target: 'E012', kind: 'id', line: 3, text: 'E12' },
])

// resolveLink
const all = [
  'docs/a/x.md', 'docs/a/HLD.md', 'docs/b/y.md', 'docs/architecture/02-high-level-design/HLD.md', 'README.md',
  'docs/notes/deep/README.md', 'plans/tasks/T093-doc-links.md', 'plans/roadmap/R056-graph.md',
  'memory/entries/E012-thing.md', 'docs/architecture/decisions/ADR-004-mcp.md', 'docs/c/Guide.md', 'docs/c/sub/Guide.md',
]
assert.equal(resolveLink('../b/y.md', 'docs/a/x.md', all), 'docs/b/y.md') // ../
assert.equal(resolveLink('./HLD.md', 'docs/a/x.md', all), 'docs/a/HLD.md') // ./
assert.equal(resolveLink('HLD.md', 'docs/a/x.md', all), 'docs/a/HLD.md') // relative wins over root
assert.equal(resolveLink('docs/b/y.md', 'docs/a/x.md', all), 'docs/b/y.md') // root-relative
assert.equal(resolveLink('/README.md', 'docs/a/x.md', all), 'README.md') // leading slash = root
assert.equal(resolveLink('../../../../x.md', 'docs/a/x.md', all), null) // above the root
assert.equal(resolveLink('y.md', 'docs/a/x.md', all, 'md'), null) // a path link never falls back to basename
assert.equal(resolveLink('HLD', 'docs/a/x.md', all), 'docs/a/HLD.md') // wikilink: same folder first
assert.equal(resolveLink('HLD', 'plans/tasks/T093-doc-links.md', all), 'docs/a/HLD.md') // shortest path
assert.equal(resolveLink('hld', 'README.md', all, 'wiki'), 'docs/a/HLD.md') // case-insensitive name
assert.equal(resolveLink('02-high-level-design/HLD', 'README.md', all), 'docs/architecture/02-high-level-design/HLD.md')
assert.equal(resolveLink('Guide', 'docs/c/sub/z.md', all), 'docs/c/sub/Guide.md') // ambiguity: same folder
assert.equal(resolveLink('Guide', 'docs/a/x.md', all), 'docs/c/Guide.md') // ambiguity: shortest
assert.equal(resolveLink('Nope', 'docs/a/x.md', all), null)
assert.equal(resolveLink('T093', 'README.md', all), 'plans/tasks/T093-doc-links.md') // ids
assert.equal(resolveLink('R056', 'README.md', all, 'id'), 'plans/roadmap/R056-graph.md')
assert.equal(resolveLink('E12', 'README.md', all, 'id'), 'memory/entries/E012-thing.md')
assert.equal(resolveLink('ADR-4', 'README.md', all, 'id'), 'docs/architecture/decisions/ADR-004-mcp.md')
assert.equal(resolveLink('T999', 'README.md', all), null)

// docNode: kinds + labels
assert.deepEqual(docNode('memory/entries/E012-thing.md', '# E012: A thing\n'), { id: 'E012', kind: 'entry', label: 'A thing', path: 'memory/entries/E012-thing.md' })
assert.deepEqual(docNode('plans/tasks/T093-x.md', '# T093: Doc links\n'), { id: 'T093', kind: 'task', label: 'Doc links', path: 'plans/tasks/T093-x.md' })
assert.deepEqual(docNode('docs/HLD.md', 'no heading'), { id: 'docs/HLD.md', kind: 'doc', label: 'HLD', path: 'docs/HLD.md' })

// buildDocGraph: edges, dedupe (first line wins), self-links, broken
const item = (path: string, text: string): DocItem => ({ node: docNode(path, text), links: extractLinks(text, path) })
const graph = buildDocGraph([
  item('docs/a/x.md', '[y](../b/y.md)\n[[y]] again\n[gone](missing.md)\n[[Gone]]\n[me](x.md)\nT999 is no file'),
  item('docs/b/y.md', '# Why\nBack to [x](../a/x.md), see T093'),
  item('plans/tasks/T093-doc-links.md', '# T093: Doc links\nT093 itself, `docs/b/y.md`'),
])
assert.deepEqual(graph.edges, [
  { from: 'docs/a/x.md', to: 'docs/b/y.md', line: 1, text: 'y' },
  { from: 'docs/b/y.md', to: 'docs/a/x.md', line: 2, text: 'x' },
  { from: 'docs/b/y.md', to: 'plans/tasks/T093-doc-links.md', line: 2, text: 'T093' },
  { from: 'plans/tasks/T093-doc-links.md', to: 'docs/b/y.md', line: 2, text: 'docs/b/y.md' },
])
assert.deepEqual(graph.broken, [
  { from: 'docs/a/x.md', target: 'missing.md', line: 3, text: 'gone', kind: 'md' },
  { from: 'docs/a/x.md', target: 'Gone', line: 4, text: 'Gone', kind: 'wiki' },
])

// docLinks
const y = docLinks(graph, 'docs/b/y.md')
assert.deepEqual(y?.in.map(r => r.path), ['docs/a/x.md', 'plans/tasks/T093-doc-links.md'])
assert.deepEqual(y?.out, [
  { path: 'docs/a/x.md', kind: 'doc', label: 'x', line: 2, text: 'x' },
  { path: 'plans/tasks/T093-doc-links.md', kind: 'task', label: 'Doc links', line: 2, text: 'T093' },
])
assert.equal(docLinks(graph, 'docs/a/x.md')?.broken.length, 2)
// targets: raw spelling → node, self-links included, misses absent
assert.deepEqual(docLinks(graph, 'docs/a/x.md')?.targets, {
  '../b/y.md': { path: 'docs/b/y.md', kind: 'doc', id: 'docs/b/y.md', label: 'Why' },
  y: { path: 'docs/b/y.md', kind: 'doc', id: 'docs/b/y.md', label: 'Why' },
  'x.md': { path: 'docs/a/x.md', kind: 'doc', id: 'docs/a/x.md', label: 'x' },
})
assert.equal(docLinks(graph, 'docs/b/y.md')?.targets.T093.kind, 'task')
assert.equal(docLinks(graph, 'nope.md'), null)

console.log('doc-links: ok')
