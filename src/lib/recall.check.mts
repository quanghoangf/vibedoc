// Self-check for recall. Run: node src/lib/recall.check.mts
import assert from 'node:assert/strict'
import { DEFAULT_SESSION_BUDGET, estimateTokens, filterEntries, fitToBudget, formatCompactLine, formatEpisodeSection, formatRelated, indexHits, rankEntries, taskQuery, tokenize, type RecallEntry } from './recall.ts'

const e = (id: string, type: string, summary: string, body = '', updatedAt = '2026-09-01'): RecallEntry =>
  ({ id, type, summary, body, updatedAt })

// tokenize: case, separators, stopwords, 1-char tokens, plurals
assert.deepEqual(tokenize('The SSE bus, and its Events!'), ['sse', 'bus', 'event'])
assert.deepEqual(tokenize('a I x of the'), [])
assert.deepEqual(tokenize('core.ts fs-only'), ['core', 'ts', 'fs', 'only'])
assert.deepEqual(tokenize('class address status'), ['class', 'address', 'statu'])
assert.deepEqual(tokenize(''), [])

// estimateTokens
assert.equal(estimateTokens(''), 0)
assert.equal(estimateTokens('abcd'), 1)
assert.equal(estimateTokens('abcde'), 2)

// acceptance: SSE entry first for "sse events"
const fixture = [
  e('E001', 'convention', 'Tailwind only, no CSS-in-JS'),
  e('E002', 'convention', 'The SSE bus lives in events.ts', 'Call emitUpdate after mutations.'),
  e('E003', 'decision', 'No database', 'File system is the source of truth.'),
]
const hits = rankEntries(fixture, 'sse events')
assert.equal(hits[0].id, 'E002')
assert.equal(hits.length, 1)

// scoring weights: summary +3, id/type +2, body +1, each once per token
const w = [
  e('E010', 'gotcha', 'redis cache', 'redis redis redis'),       // summary 3 + body 1 = 4
  e('E011', 'redis', 'other', ''),                              // type 2
  e('E012', 'note', 'other', 'uses redis'),                     // body 1
  e('E013', 'note', 'other', 'nothing'),                        // 0 → dropped
]
assert.deepEqual(rankEntries(w, 'redis').map(h => [h.id, h.score]), [['E010', 4], ['E011', 2], ['E012', 1]])
assert.deepEqual(rankEntries(w, 'e012').map(h => [h.id, h.score]), [['E012', 2]])
assert.equal(rankEntries(w, 'redis redis')[0].score, 4, 'duplicate query tokens count once')

// tie-break by recency, newest first
const ties = [e('E020', 'note', 'deploy steps', '', '2026-01-01'), e('E021', 'note', 'deploy notes', '', '2026-09-01')]
assert.deepEqual(rankEntries(ties, 'deploy').map(h => h.id), ['E021', 'E020'])

// type filter (exact) and limit (default 10)
assert.deepEqual(rankEntries(fixture, 'tailwind', { type: 'decision' }).map(h => h.id), [])
assert.deepEqual(rankEntries(fixture, 'database', { type: 'decision' }).map(h => h.id), ['E003'])
assert.deepEqual(rankEntries(fixture, 'database', { type: 'convention' }), [])
const many = Array.from({ length: 30 }, (_, i) => e(`E${100 + i}`, 'note', `widget ${i}`))
assert.equal(rankEntries(many, 'widget').length, 10)
assert.equal(rankEntries(many, 'widget', { limit: 3 }).length, 3)

// empty / all-stopword query → no hits, no crash
assert.deepEqual(rankEntries(fixture, ''), [])
assert.deepEqual(rankEntries(fixture, 'the and of'), [])

// hits carry no body; compact line format
const h = rankEntries(fixture, 'sse')[0]
assert.equal('body' in h, false)
assert.equal(formatCompactLine({ id: 'E012', type: 'convention', summary: 'Only core.ts touches fs', tokens: 120, score: 3 }),
  'E012 · convention · Only core.ts touches fs (~120 tok)')

// 200+ synthetic entries: the target is in the top 10
const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima']
const big: RecallEntry[] = Array.from({ length: 240 }, (_, i) =>
  e(`E${String(i + 1).padStart(3, '0')}`, ['convention', 'gotcha', 'decision', 'preference'][i % 4],
    `${words[i % 12]} ${words[(i * 5) % 12]} rule ${i}`, `${words[(i * 7) % 12]} details and sse mention ${i % 3 ? '' : 'events'}`,
    `2026-${String((i % 9) + 1).padStart(2, '0')}-01`))
big.push(e('E999', 'gotcha', 'SSE events drop on project switch', 'Reconnect the EventSource when root changes.', '2025-01-01'))
const top = rankEntries(big, 'sse events project switch')
assert.equal(top.length, 10)
assert.ok(top.some(t => t.id === 'E999'), 'target in top 10')
assert.equal(top[0].id, 'E999')

// indexHits: newest first, id breaks ties, no bodies
assert.deepEqual(indexHits([e('E002', 'note', 'b', 'x', '2026-01-01'), e('E003', 'note', 'c', '', '2026-05-01'), e('E001', 'note', 'a', '', '2026-05-01')]).map(h => h.id),
  ['E001', 'E003', 'E002'])

// fitToBudget: everything fits → all lines, no footer
const handoff = '# Project Memory\nhandoff text\n'
const few = indexHits(fixture)
const all = fitToBudget(handoff, few, 2000)
assert.equal(all.shown, 3)
assert.equal(all.omitted, 0)
assert.ok(!all.text.includes('more entries'))
assert.ok(all.text.startsWith('# Project Memory\nhandoff text\n\n## Knowledge entries (3)\n'))
assert.equal(all.tokens, estimateTokens(all.text))

// overflow: footer counted, result within budget, more budget → more lines
const bigIndex = indexHits(big)
const tight = fitToBudget(handoff, bigIndex, 300)
assert.ok(tight.tokens <= 300, `tight ${tight.tokens}`)
assert.ok(tight.shown > 0 && tight.omitted > 0)
assert.equal(tight.shown + tight.omitted, bigIndex.length)
assert.ok(tight.text.includes(`+${tight.omitted} more entries — use vibedoc_recall { query }`))
assert.ok(fitToBudget(handoff, bigIndex, 600).shown > tight.shown)

// 200+ entries at the default budget stay inside it
const def = fitToBudget(handoff, bigIndex, DEFAULT_SESSION_BUDGET)
assert.ok(def.tokens <= DEFAULT_SESSION_BUDGET, `default ${def.tokens}`)
assert.ok(def.omitted > 0)

// handoff alone over budget: never cut, no index lines, one warning
const longHandoff = 'x'.repeat(4000)
const over = fitToBudget(longHandoff, few, 500)
assert.equal(over.shown, 0)
assert.ok(over.text.startsWith(longHandoff))
assert.match(over.text, /over the 500-token session budget: trim memory\/MEMORY.md/)

// empty index
assert.equal(fitToBudget(handoff, [], 2000).text,
  '# Project Memory\nhandoff text\n\n## Knowledge entries (0)\nSave new facts with vibedoc_save_entry; fetch bodies with vibedoc_get_entries.')

// episode section (R050): heading with the end date, body whole, "+N older" only when more are newer
const ep = { end: '2026-10-03T13:05:00.000Z', body: '## What happened\n- T113 → done\n\n## Where it stopped\n> wired the builder' }
const epSection = formatEpisodeSection(ep)
assert.equal(epSection, '## Since the last handoff (auto, 2026-10-03)\n### What happened\n- T113 → done\n\n### Where it stopped\n> wired the builder')
assert.match(formatEpisodeSection(ep, 2), /\+2 older episodes in \.vibedoc\/episodes\/$/)
assert.match(formatEpisodeSection(ep, 1), /\+1 older episode in /)

// no episode → identical to before
assert.equal(fitToBudget(handoff, few, 2000, '').text, all.text)

// episode fits: handoff → episode → index, all lines shown
const withEp = fitToBudget(handoff, few, 2000, epSection)
assert.equal(withEp.shown, 3)
assert.ok(withEp.text.startsWith(`${handoff.trimEnd()}\n\n${epSection}\n\n## Knowledge entries (3)\n`))

// episode pushes index lines out, still within budget
const epTight = fitToBudget(handoff, bigIndex, 300, epSection)
assert.ok(epTight.tokens <= 300, `epTight ${epTight.tokens}`)
assert.ok(epTight.shown < tight.shown && epTight.omitted > tight.omitted)
assert.ok(epTight.text.includes(epSection))

// handoff + episode over budget: both whole, no index lines, warning names both
const bigEp = formatEpisodeSection({ end: ep.end, body: 'y'.repeat(1600) })
const epOver = fitToBudget(handoff, few, 300, bigEp)
assert.equal(epOver.shown, 0)
assert.ok(epOver.text.includes(bigEp))
assert.match(epOver.text, /The handoff and the latest episode are ~\d+ tokens, over the 300-token session budget/)

// taskQuery: title + Goal (capped) + epic title without its id; other sections ignored
const raw = '# T090: SSE reconnect\n**Phase:** R012 — Live updates\n\n## Goal\nKeep the EventSource alive.\n\n## Scope\n- [ ] kubernetes\n'
assert.equal(taskQuery({ title: 'SSE reconnect on project switch', phase: 'R012 — Live updates', raw }),
  'SSE reconnect on project switch Keep the EventSource alive. Live updates')
assert.equal(taskQuery({ title: 'Only title' }), 'Only title')
assert.equal(taskQuery({ title: 'T', raw: '## Goal\nlast section' }), 'T last section')
assert.equal(taskQuery({ title: 'T', raw: `## Goal\n${'y'.repeat(900)}\n## Scope` }).length, 2 + 500)

// formatRelated: strong matches only (score ≥ 3), max 3, '' when none, never bodies
const rel = rankEntries([
  e('E030', 'gotcha', 'SSE drops on project switch', 'Reconnect the EventSource.'),
  e('E031', 'note', 'unrelated', 'mentions sse in body only'),
  e('E032', 'convention', 'Tailwind only'),
], taskQuery({ title: 'SSE reconnect on project switch', phase: 'R012 — Live updates', raw }))
assert.equal(formatRelated(rel), '## Related memory\nE030 · gotcha · SSE drops on project switch (~14 tok)\nFetch with vibedoc_get_entries')
assert.equal(formatRelated(rankEntries([e('E031', 'note', 'unrelated', 'sse')], 'sse')), '')
assert.equal(formatRelated([]), '')
const four = rankEntries(Array.from({ length: 5 }, (_, i) => e(`E04${i}`, 'note', `deploy step ${i}`)), 'deploy')
assert.equal(formatRelated(four).split('\n').filter(l => l.startsWith('E')).length, 3)

// filterEntries (Memory tab list): newest first without a query, ranked with one, type filter, full entries back
const mem = [
  e('E101', 'convention', 'Tailwind only, no CSS-in-JS', '', '2026-09-01'),
  e('E102', 'gotcha', 'The SSE bus drops events on project switch', 'Reconnect the EventSource.', '2026-09-20'),
  e('E103', 'decision', 'No database', 'Files are the source of truth.', '2026-09-10'),
  e('E104', 'gotcha', 'Due dates are local calendar dates', '', '2026-09-25'),
]
const fids = (o: { query?: string; type?: string | null }) => filterEntries(mem, o).map(x => x.id)
assert.deepEqual(fids({}), ['E104', 'E102', 'E103', 'E101'])
assert.deepEqual(fids({ query: '  the ' }), ['E104', 'E102', 'E103', 'E101'])
assert.deepEqual(fids({ type: 'gotcha' }), ['E104', 'E102'])
assert.deepEqual(fids({ type: 'preference' }), [])
assert.deepEqual(fids({ query: 'sse events' }), ['E102'])
assert.equal(filterEntries(mem, { query: 'sse' })[0].body, 'Reconnect the EventSource.')
assert.deepEqual(fids({ query: 'dates database', type: 'gotcha' }), ['E104'])
assert.deepEqual(fids({ query: 'database', type: 'gotcha' }), [])
assert.deepEqual(fids({ query: 'kubernetes' }), [])
assert.deepEqual(filterEntries([], { query: 'sse' }), [])

console.log('recall: ok')
