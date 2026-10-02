// Self-check for doc-links. Run: node src/lib/doc-links.check.mts
import assert from 'node:assert/strict'
import { buildDocGraph, docLinks, docNode, extractLinks, formatRelatedFiles, isExampleTarget, resolveLink, touchedPaths, type DocItem } from './doc-links.ts'

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
  { target: 'HLD', kind: 'wiki', line: 2, text: 'HLD', context: 'See y and HLD, the design and docs/x.md.' },
  { target: 'HLD', kind: 'wiki', line: 2, text: 'the design' },
  { target: 'docs/x.md', kind: 'code', line: 2, text: 'docs/x.md', context: 'See y and HLD, the design and docs/x.md.' },
  { target: 'T093', kind: 'id', line: 3, text: 'T093', context: 'Ids: T093, R056, ADR-4, E12; not XT0651, e2e, E0.' },
  { target: 'R056', kind: 'id', line: 3, text: 'R056', context: 'Ids: T093, R056, ADR-4, E12; not XT0651, e2e, E0.' },
  { target: 'ADR-004', kind: 'id', line: 3, text: 'ADR-4' },
  { target: 'E012', kind: 'id', line: 3, text: 'E12' },
])
// context: a leading `path:` drops, a line that is only the link takes the heading above
assert.deepEqual(extractLinks('## Docs to update\n- [ ] `docs/h.md`: add **the** tool. Then more.\n- `docs/i.md`').map(l => l.context), [
  'add the tool.', 'Docs to update',
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
// wikilink to an item id → the item's file (not a basename miss)
assert.equal(resolveLink('T093', 'README.md', all, 'wiki'), 'plans/tasks/T093-doc-links.md')
assert.equal(resolveLink('E12', 'README.md', all, 'wiki'), 'memory/entries/E012-thing.md')
// explicit ./ or ../ never falls back to the root: no docs/a/README.md, root README.md exists
assert.equal(resolveLink('./README.md', 'docs/a/x.md', all), null)
assert.equal(resolveLink('../README.md', 'docs/a/x.md', all), null)
assert.equal(resolveLink('README.md', 'docs/a/x.md', all), 'README.md') // bare name still does

// titles, percent-encoding, ~~~ fences, inline code
assert.deepEqual(extractLinks([
  '[t](b.md "Title") [u](c.md \'T\') [sp](my%20doc.md) [`code`](d.md)',
  '~~~',
  '[[ghost]] ```',
  '~~~',
  '`[[ghost3]]` `[x](gone.md)` [[real]]',
  '````',
  '```',
  '[[inner]]',
  '````',
].join('\n'), 'docs/a.md'), [
  { target: 'b.md', kind: 'md', line: 1, text: 't' },
  { target: 'c.md', kind: 'md', line: 1, text: 'u' },
  { target: 'my doc.md', kind: 'md', line: 1, text: 'sp' },
  { target: 'd.md', kind: 'md', line: 1, text: '`code`' },
  { target: 'real', kind: 'wiki', line: 5, text: 'real', context: 'ghost3 x real' },
])

// docNode: kinds + labels
assert.deepEqual(docNode('memory/entries/E012-thing.md', '# E012: A thing\n'), { id: 'E012', kind: 'entry', label: 'A thing', path: 'memory/entries/E012-thing.md' })
assert.deepEqual(docNode('plans/tasks/T093-x.md', '# T093: Doc links\n'), { id: 'T093', kind: 'task', label: 'Doc links', path: 'plans/tasks/T093-x.md' })
// labels are plain text: no link, emphasis or code syntax from the H1
assert.equal(docNode('CHANGELOG.md', '# [1.10.0](https://github.com/x/y/compare/v1.9.0...v1.10.0) (2026-09-30)\n').label, '1.10.0 (2026-09-30)')
assert.equal(docNode('docs/a.md', '# The **bold** `code` and _em_ [[HLD|design]] snake_case_name\n').label, 'The bold code and em design snake_case_name')
assert.deepEqual(docNode('docs/HLD.md', 'no heading'), { id: 'docs/HLD.md', kind: 'doc', label: 'HLD', path: 'docs/HLD.md' })
// a sentence H1 is prose, not a title: the file name instead; a question, a dash or a trailing ellipsis stays a title
assert.equal(docNode('AGENTS.md', '# See CLAUDE.md — this file mirrors it for cross-tool compatibility (Cursor, Windsurf, Copilot Workspace).\n').label, 'AGENTS')
assert.equal(docNode('docs/q.md', '# Why not a database?\n').label, 'Why not a database?')
assert.equal(docNode('plans/tasks/T001-x.md', '# T001: Fix it now!\n').label, 'T001-x')
assert.equal(docNode('CLAUDE.md', '# VibeDoc — Agent Instructions\n').label, 'VibeDoc — Agent Instructions')
assert.equal(docNode('docs/w.md', '# Wait...\n').label, 'Wait...')
assert.equal(docNode('docs/v.md', '# v1.2\n').label, 'v1.2')

// buildDocGraph: edges, dedupe (first line wins), self-links, broken
const item = (path: string, text: string): DocItem => ({ node: docNode(path, text), links: extractLinks(text, path) })
const graph = buildDocGraph([
  item('docs/a/x.md', '[y](../b/y.md)\n[[y]] again\n[gone](missing.md)\n[[Gone]]\n[me](x.md)\nT999 is no file'),
  item('docs/b/y.md', '# Why\nBack to [x](../a/x.md), see T093'),
  item('plans/tasks/T093-doc-links.md', '# T093: Doc links\nT093 itself, `docs/b/y.md`\nMoved: `docs/old.md` and [[Gone]]'),
])
assert.deepEqual(graph.edges, [
  { from: 'docs/a/x.md', to: 'docs/b/y.md', line: 1, text: 'y' },
  { from: 'docs/b/y.md', to: 'docs/a/x.md', line: 2, text: 'x' },
  { from: 'docs/b/y.md', to: 'plans/tasks/T093-doc-links.md', line: 2, text: 'T093', context: 'Back to x, see T093' },
  { from: 'plans/tasks/T093-doc-links.md', to: 'docs/b/y.md', line: 2, text: 'docs/b/y.md', context: 'T093 itself, docs/b/y.md' },
])
assert.deepEqual(graph.broken, [
  { from: 'docs/a/x.md', target: 'missing.md', line: 3, text: 'gone', kind: 'md' },
  { from: 'docs/a/x.md', target: 'Gone', line: 4, text: 'Gone', kind: 'wiki' },
  { from: 'plans/tasks/T093-doc-links.md', target: 'Gone', line: 3, text: 'Gone', kind: 'wiki' },
])
// a backticked path to a missing file is a stale mention, never broken
assert.deepEqual(graph.stale, [{ from: 'plans/tasks/T093-doc-links.md', target: 'docs/old.md', line: 3, text: 'docs/old.md', kind: 'code' }])

// docLinks
const y = docLinks(graph, 'docs/b/y.md')
assert.deepEqual(y?.in.map(r => r.path), ['docs/a/x.md', 'plans/tasks/T093-doc-links.md'])
assert.deepEqual(y?.out, [
  { path: 'docs/a/x.md', kind: 'doc', label: 'x', line: 2, text: 'x' },
  { path: 'plans/tasks/T093-doc-links.md', kind: 'task', label: 'Doc links', line: 2, text: 'T093', context: 'Back to x, see T093' },
])
assert.equal(docLinks(graph, 'docs/a/x.md')?.broken.length, 2)
assert.deepEqual(docLinks(graph, 'docs/a/x.md')?.stale, [])
const t = docLinks(graph, 'plans/tasks/T093-doc-links.md')
assert.deepEqual(t?.broken.map(r => r.path), ['Gone'])
assert.deepEqual(t?.stale, [{ path: 'docs/old.md', kind: 'code', label: 'docs/old.md', line: 3, text: 'docs/old.md' }])
// targets: raw spelling → node, self-links included, misses absent
assert.deepEqual(docLinks(graph, 'docs/a/x.md')?.targets, {
  '../b/y.md': { path: 'docs/b/y.md', kind: 'doc', id: 'docs/b/y.md', label: 'Why' },
  y: { path: 'docs/b/y.md', kind: 'doc', id: 'docs/b/y.md', label: 'Why' },
  'x.md': { path: 'docs/a/x.md', kind: 'doc', id: 'docs/a/x.md', label: 'x' },
})
assert.equal(docLinks(graph, 'docs/b/y.md')?.targets.T093.kind, 'task')
assert.equal(docLinks(graph, 'nope.md'), null)

// formatRelatedFiles: ids for items, paths for docs, lines on incoming + broken, cap, empty, broken only
assert.equal(formatRelatedFiles(docLinks(graph, 'docs/b/y.md')), [
  '## Related files',
  'Links to: docs/a/x.md · T093',
  'Linked from: docs/a/x.md (L1) · T093 (L2)',
  'Read with vibedoc_read_doc, or several at once with vibedoc_get_context { paths }.',
].join('\n'))
const row = (path: string, line = 1) => ({ path, kind: 'doc', label: path, line, text: path })
const many = Array.from({ length: 12 }, (_, i) => row(`docs/d${i}.md`))
assert.equal(formatRelatedFiles({ out: many, in: [], broken: [] }, 10).split('\n')[1],
  `Links to: ${many.slice(0, 10).map(r => r.path).join(' · ')} (+2 more)`)
assert.equal(formatRelatedFiles({ out: [], in: [], broken: [] }), '')
assert.equal(formatRelatedFiles(null), '')
assert.deepEqual(formatRelatedFiles({ out: [], in: [], broken: [row('missing.md', 8)] }).split('\n'), [
  '## Related files',
  'Broken: missing.md (L8)',
  'Read with vibedoc_read_doc, or several at once with vibedoc_get_context { paths }.',
])

// Broken is md / wiki only; code mentions go to Stale paths
assert.deepEqual(formatRelatedFiles(t).split('\n').slice(1, -1), [
  'Links to: docs/b/y.md',
  'Linked from: docs/b/y.md (L2)',
  'Broken: Gone (L3)',
  'Stale paths: docs/old.md (L3)',
])

// backticked globs are patterns, not links
assert.deepEqual(extractLinks('see `memory/entries/E*.md` and `plans/{a,b}.md` and `docs/x.md`', 'CLAUDE.md').map(l => l.target), ['docs/x.md'])

// T109: placeholders are templates, never files (all link kinds)
assert.deepEqual(extractLinks([
  '`memory/entries/E001-<slug>.md` `plans/tasks/T00N-slug.md` `skills/T<NNN>-x.md` `docs/meetings/YYYY-MM-DD.md`',
  '`docs/.../mcp-tools.md` `docs/…/a.md` `plans/NNN.md` `XXX.md` [p](<name>-copy.md) [[{id}]]',
  '`docs/NOTES.md` `docs/Xylophone.md` `plans/T001-real.md`',
].join('\n')).filter(l => l.kind !== 'id').map(l => l.target), ['docs/NOTES.md', 'docs/Xylophone.md', 'plans/T001-real.md'])

{
  const paths = ['README.md', 'memory/MEMORY.md', 'docs/arch/HLD.md', 'docs/dup/a/same.md', 'docs/dup/b/same.md']
  // @include: the @ is dropped, the rest resolves as a path (raw target kept as written)
  assert.equal(resolveLink('@docs/arch/HLD.md', 'notes/n.md', paths, 'code'), 'docs/arch/HLD.md')
  assert.equal(resolveLink('@docs/HLD.md', 'notes/n.md', paths, 'code'), null)
  // a backticked bare name resolves to the one file with that name; same folder still wins first
  assert.equal(resolveLink('MEMORY.md', 'README.md', paths, 'code'), 'memory/MEMORY.md')
  assert.equal(resolveLink('MEMORY.md', 'README.md', paths, 'md'), null) // a link must work as written
  assert.equal(resolveLink('same.md', 'docs/dup/a/other.md', paths, 'code'), 'docs/dup/a/same.md')
  // shared by two files: no edge to either
  assert.equal(resolveLink('same.md', 'README.md', paths, 'code'), null)
  // a slash means a path: no basename fallback
  assert.equal(resolveLink('nope/MEMORY.md', 'README.md', paths, 'code'), null)
  // syntax examples: the whole name (or the rest after an item id) is a placeholder word
  for (const t of ['path.md', 'x.md', 'name', 'wikilinks', 'docs/a/x.md', '../a.md', 'plans/tasks/T001-x.md', 'docs/ADR-001-title.md'])
    assert.equal(isExampleTarget(t), true, t)
  // a placeholder word as one `-` part of a longer name is a real file name
  for (const t of ['missing.md', 'docs/gone.md', 'far-away.md', 'R004-billing.md', 'docs/xray.md', 'docs/user-name.md',
    'plans/plan-b.md', 'docs/page-title.md', 'api-name', 'docs/old-name.md', 'docs/feature-flag-a.md', 'getting-started-example', 'docs/api-path.md'])
    assert.equal(isExampleTarget(t), false, t)

  const item = (path: string, raw: string): DocItem => ({ node: docNode(path, raw), links: extractLinks(raw, path) })
  const g = buildDocGraph([
    item('README.md', [
      '# R', '[[wikilinks]] and [text](path.md) or [[name]]; `x.md`', // syntax examples: no miss
      '[x](missing.md) and `docs/gone.md`', // real misses stay
      '[G](docs/user-name.md) [P](plans/plan-b.md) [[api-name]] `docs/old-name.md`', // a placeholder word inside a name: real
      '`MEMORY.md` `@docs/arch/HLD.md` `same.md` `@docs/HLD.md`', // bare unique, @include, shared name, real stale
      '`.claude/skills/r/craft-floor.md` `craft-floor.md` [s](.claude/skills/r/s.md)', // exist outside the graph
    ].join('\n')),
    ...paths.slice(1).map(p => item(p, '# P')),
  ], ['.claude/skills/r/craft-floor.md', '.claude/skills/r/s.md'])
  assert.deepEqual(g.broken.map(b => b.target), ['missing.md', 'docs/user-name.md', 'plans/plan-b.md', 'api-name'])
  assert.deepEqual(g.stale.map(b => b.target), ['docs/gone.md', 'docs/old-name.md', '@docs/HLD.md'])
  // resolved edges; files outside the graph get no edge and no target (the UI can't open them)
  assert.deepEqual(g.edges.filter(e => e.from === 'README.md').map(e => e.to), ['memory/MEMORY.md', 'docs/arch/HLD.md'])
  assert.equal(g.targets['README.md']['@docs/arch/HLD.md'], 'docs/arch/HLD.md')
  assert.equal(g.targets['README.md']['craft-floor.md'], undefined)
  // a real file named like an example still links
  assert.deepEqual(buildDocGraph([item('a.md', '[[x]]'), item('x.md', '# X')]).edges.map(e => e.to), ['x.md'])
}

// touchedPaths: which files the activity log says changed since a cutoff (T110 Recent)
{
  const nodes = [
    docNode('plans/tasks/T001-a.md', '# T001: A\n**Status:** done'), docNode('plans/roadmap/R002-b.md', '# R002: B'),
    docNode('docs/x.md', '# X'), docNode('docs/new.md', '# N'), docNode('memory/MEMORY.md', '# M'),
    docNode('memory/entries/E004-c.md', '# E004: C'), docNode('docs/architecture/decisions/ADR-003-d.md', '# ADR-003: D'), docNode('docs/old.md', '# O'),
    docNode('plans/tasks/T005-new.md', '# T005: New'),
  ]
  const at = (h: number) => new Date(Date.UTC(2026, 9, 2, h)).toISOString()
  const ev = (h: number, type: string, title: string, more: object = {}) => ({ timestamp: at(h), type, title, ...more })
  const got = touchedPaths([
    ev(10, 'task_updated', 'T001 moved to done', { taskId: 'T001', detail: 'docs/old.md' }), // a task title is not a path
    ev(9, 'roadmap_updated', 'R002 updated', { detail: 'B' }),
    ev(9, 'doc_updated', 'Edited docs/x.md', { detail: 'docs/x.md' }),
    ev(8, 'doc_renamed', 'Renamed docs/gone.md → docs/new.md'),
    ev(8, 'memory_updated', 'Session memory updated', { detail: 'handoff' }),
    ev(8, 'memory_updated', 'Entry E004 saved', { detail: 'C' }),
    ev(8, 'decision_logged', 'ADR-003: D', { detail: 'why' }),
    ev(8, 'task_updated', 'T005 created', { taskId: 'T005', detail: 'New' }), // createTask / applyPlan log this
    ev(8, 'task_updated', 'T999 deleted', { taskId: 'T999' }), // no such file any more
    ev(1, 'doc_updated', 'Edited docs/old.md', { detail: 'docs/old.md' }), // before the cutoff
  ], nodes, Date.UTC(2026, 9, 2, 2))
  assert.deepEqual([...got].sort(), ['docs/architecture/decisions/ADR-003-d.md', 'docs/new.md', 'docs/x.md', 'memory/MEMORY.md', 'memory/entries/E004-c.md', 'plans/roadmap/R002-b.md', 'plans/tasks/T001-a.md', 'plans/tasks/T005-new.md'])
}

console.log('doc-links: ok')
