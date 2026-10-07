// node src/lib/doc-usage.check.mts
import assert from 'node:assert/strict'
import { parseUsage, recordRead, recordSearch, summarizeUsage, emptyUsage, MAX_READS, MAX_SEARCHES } from './doc-usage.ts'

assert.deepEqual(parseUsage(null), emptyUsage())
assert.deepEqual(parseUsage('nope'), emptyUsage())
assert.deepEqual(parseUsage('{"reads":{"a.md":{"count":0,"last":"2026-10-07T00:00:00Z"},"b.md":{"count":2,"last":"x"}}}').reads, {})
assert.deepEqual(parseUsage('{"reads":{"a.md":{"count":2,"last":"2026-10-07T00:00:00Z","x":1}}}').reads, { 'a.md': { count: 2, last: '2026-10-07T00:00:00Z' } })

const t = (m: number) => new Date(Date.UTC(2026, 9, 7, 10, m))
let u = recordRead(emptyUsage(), 'docs/a.md', t(0))
u = recordRead(u, 'docs/a.md', t(1))
u = recordRead(u, 'docs/b.md', t(2))
assert.deepEqual(u.reads['docs/a.md'], { count: 2, last: t(1).toISOString() })
assert.equal(parseUsage(JSON.stringify(u)).reads['docs/a.md'].count, 2, 'round-trips')

// summary: most read first, deleted docs dropped, never read = docs only
u = recordRead(u, 'docs/gone.md', t(3))
const s = summarizeUsage(u, ['docs/a.md', 'docs/b.md', 'docs/c.md', 'plans/tasks/T001-x.md'], ['docs/c.md', 'docs/a.md', 'docs/b.md'])
assert.deepEqual(s.mostRead.map((r) => r.path), ['docs/a.md', 'docs/b.md'])
assert.deepEqual(s.neverRead, ['docs/c.md'])

// bounded: the oldest reads fall off
let big = emptyUsage()
for (let i = 0; i <= MAX_READS; i++) big = recordRead(big, `d${i}.md`, new Date(Date.UTC(2026, 0, 1) + i * 1000))
assert.equal(Object.keys(big.reads).length, MAX_READS)
assert.equal(big.reads['d0.md'], undefined, 'oldest dropped')
assert.ok(big.reads[`d${MAX_READS}.md`])

// searches that found nothing: coalesced per normalized query, removed once found
let w = recordSearch(emptyUsage(), 'Deploy  widget ', false, t(0))
w = recordSearch(w, 'deploy widget', false, t(1))
w = recordSearch(w, 'billing', false, t(2))
assert.equal(recordSearch(w, '   ', false, t(3)), w, 'blank query ignored')
assert.equal(recordSearch(w, 'other', true, t(3)), w, 'a found search with no miss changes nothing')
assert.deepEqual(w.searches['deploy widget'], { query: 'deploy widget', count: 2, last: t(1).toISOString() })
assert.deepEqual(summarizeUsage(w, [], []).notFound.map((s) => s.query), ['billing', 'deploy widget'])
assert.equal(parseUsage(JSON.stringify(w)).searches['billing'].count, 1, 'round-trips')
w = recordSearch(w, 'DEPLOY widget', true, t(4))
assert.deepEqual(Object.keys(w.searches), ['billing'])
let many = emptyUsage()
for (let i = 0; i <= MAX_SEARCHES; i++) many = recordSearch(many, `q${i}`, false, new Date(Date.UTC(2026, 0, 1) + i * 1000))
assert.equal(Object.keys(many.searches).length, MAX_SEARCHES)
assert.equal(many.searches['q0'], undefined, 'oldest search dropped')

console.log('doc-usage ok')
