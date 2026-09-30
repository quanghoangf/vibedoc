// Self-check for recall. Run: node src/lib/recall.check.mts
import assert from 'node:assert/strict'
import { estimateTokens, formatCompactLine, rankEntries, tokenize, type RecallEntry } from './recall.ts'

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

console.log('recall: ok')
