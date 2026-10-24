// Self-check for cross-project search. Run: node src/lib/cross-search.check.mts
import assert from 'node:assert/strict'
import { formatCrossSearch, highlightParts, hitHref, mergeResults, rankItems, snippetText, type CrossHit } from './cross-search.ts'
import { tokenize } from './recall.ts'

const web = { id: 'web', name: 'Web' }
const api = { id: 'api', name: 'Api' }
const hit = (path: string, score: number, kind: CrossHit['kind'] = 'doc'): CrossHit => ({ kind, id: null, path, title: path, snippet: '', score })

// tasks / epics: +3 per title token, +2 for the id
const items = [
  { kind: 'task' as const, id: 'T001', path: 'plans/tasks/T001-rate.md', title: 'Rate limit the login', snippet: 'todo' },
  { kind: 'epic' as const, id: 'R002', path: 'plans/roadmap/R002-x.md', title: 'Billing', snippet: 'planned' },
]
assert.deepEqual(rankItems(items, 'rate limit', tokenize).map(h => [h.id, h.score]), [['T001', 6]])
assert.deepEqual(rankItems(items, 'R002', tokenize).map(h => [h.id, h.score]), [['R002', 2]])
assert.deepEqual(rankItems(items, 'the', tokenize), [])

// grouped by project, best project first, top N per project, total cap
const groups = mergeResults([
  { project: web, hits: [hit('a.md', 1), hit('b.md', 2)] },
  { project: api, hits: [hit('decision.md', 6), hit('c.md', 1)] },
])
assert.deepEqual(groups.map(g => g.project.id), ['api', 'web'])
assert.deepEqual(groups[0].results.map(r => r.path), ['decision.md', 'c.md'])
assert.deepEqual(groups[1].results.map(r => r.path), ['b.md', 'a.md'])
assert.equal(groups[0].results[0].project.id, 'api')

const many = (n: number) => Array.from({ length: n }, (_, i) => hit(`f${String(i).padStart(2, '0')}.md`, 1))
assert.equal(mergeResults([{ project: web, hits: many(15) }])[0].results.length, 10)
const capped = mergeResults(Array.from({ length: 7 }, (_, i) => ({ project: { id: `p${i}`, name: `P${i}` }, hits: many(10) })))
assert.equal(capped.reduce((s, g) => s + g.results.length, 0), 50)
assert.deepEqual(mergeResults([{ project: web, hits: [hit('a.md', 2)] }, { project: api, hits: [hit('a.md', 2)] }]).map(g => g.project.id), ['web', 'api']) // a tie keeps project order
assert.deepEqual(mergeResults([{ project: web, hits: [] }]), [])

// ties: doc before entry before epic before task
const tied = mergeResults([{ project: web, hits: [hit('t.md', 3, 'task'), hit('d.md', 3, 'doc'), hit('e.md', 3, 'entry')] }])
assert.deepEqual(tied[0].results.map(r => r.kind), ['doc', 'entry', 'task'])

// agent text: every result line is prefixed with the project id
const text = formatCrossSearch('rate limit', [{ project: api, results: [{ ...hit('docs/decisions/rate-limit.md', 6), title: 'Rate limit', snippet: 'L3: we rate limit', project: api }] }])
assert.match(text, /^🔍 "rate limit" — 1 result\(s\) in 1 project\(s\)/)
assert.match(text, /^\[api\] doc \*\*Rate limit\*\* — docs\/decisions\/rate-limit\.md$/m)
assert.match(text, /^\[api\] {3}L3: we rate limit$/m)
assert.equal(formatCrossSearch('x', []), 'No results for "x" in this project\'s groups')

// deep links per kind
assert.equal(hitHref({ kind: 'doc', id: null, path: 'docs/a b.md' }), '/docs?doc=docs%2Fa%20b.md')
assert.equal(hitHref({ kind: 'task', id: 'T001', path: 'x' }), '/board?task=T001')
assert.equal(hitHref({ kind: 'epic', id: 'R002', path: 'x' }), '/roadmap?item=R002')
assert.equal(hitHref({ kind: 'entry', id: 'E001', path: 'x' }), '/memory?entry=E001')

// snippets lose the line prefix and the markdown markers; matches split out case-insensitively
assert.equal(snippetText('L1: # Project memory'), 'Project memory')
assert.equal(snippetText('L40: - [x] See [the guide](docs/g.md) and `core.ts`'), 'See the guide and core.ts')
assert.equal(snippetText('L3: | Tasks | plans/tasks |'), 'Tasks · plans/tasks')
// a commit link in parentheses, and a link the excerpt cut before its `)`, keep only their text
assert.equal(snippetText('L9: - Fix the board ([afc397f](https://github.com/x/y/commit/afc397f))'), 'Fix the board afc397f')
assert.equal(snippetText('L9: see [the guide](https://example.com/very/lo'), 'see the guide')
// status emoji read as words; "✅ Done" keeps one Done
assert.equal(snippetText('L4: | T001 | ✅ | Login |'), 'T001 · Done · Login')
assert.equal(snippetText('L4: ✅ Done: T001, ⏳ T002, 🔨 T003'), 'Done: T001, To do T002, In progress T003')
assert.equal(snippetText('L4: ⏸️ paused for now'), 'paused for now')
assert.deepEqual(highlightParts('Project memory', 'memory proj'), [{ text: 'Proj', hit: true }, { text: 'ect ', hit: false }, { text: 'memory', hit: true }])
assert.deepEqual(highlightParts('a.b', 'a'), [{ text: 'a.b', hit: false }], 'one-letter words are not marked')
assert.deepEqual(highlightParts('x (y)', '(y'), [{ text: 'x (y)', hit: false }], 'punctuation is not a word')

console.log('cross-search: ok')
