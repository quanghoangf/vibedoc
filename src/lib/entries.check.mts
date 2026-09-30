// Self-check for entries. Run: node src/lib/entries.check.mts
import assert from 'node:assert/strict'
import { entrySlug, formatEntry, nextEntryId, normalizeEntryId, parseEntry, validateEntryInput } from './entries.ts'

// normalizeEntryId: case, padding, junk
assert.equal(normalizeEntryId('e1'), 'E001')
assert.equal(normalizeEntryId('E01'), 'E001')
assert.equal(normalizeEntryId(' E001 '), 'E001')
assert.equal(normalizeEntryId('E1234'), 'E1234')
assert.equal(normalizeEntryId('E0'), null)
assert.equal(normalizeEntryId('T001'), null)
assert.equal(normalizeEntryId('E1a'), null)

// nextEntryId: empty, gaps, unpadded
assert.equal(nextEntryId([]), 'E001')
assert.equal(nextEntryId(['E001', 'E007']), 'E008')
assert.equal(nextEntryId(['e9', 'junk']), 'E010')

// entrySlug
assert.equal(entrySlug('Only core.ts touches the file system'), 'only-core-ts-touches-the-file-system')
assert.equal(entrySlug('  --Hello, World!--  '), 'hello-world')
assert.ok(entrySlug('a'.repeat(30) + ' ' + 'b'.repeat(30)).length <= 40)
assert.ok(!entrySlug('x'.repeat(39) + ' yyy').endsWith('-'))

// parse → format round trip
const e = { id: 'E001', type: 'convention' as const, summary: 'Only core.ts touches fs', body: 'API routes import from core.\n\nWhy: one place.', updatedAt: '2026-09-30' }
const raw = formatEntry(e)
assert.equal(raw, '# E001: Only core.ts touches fs\n**Type:** convention\n**Updated:** 2026-09-30\n\nAPI routes import from core.\n\nWhy: one place.\n')
assert.deepEqual(parseEntry(raw, 'memory/entries/E001-x.md'), { ...e, file: 'memory/entries/E001-x.md' })

// empty body round trip
const noBody = formatEntry({ ...e, body: '' })
assert.equal(noBody, '# E001: Only core.ts touches fs\n**Type:** convention\n**Updated:** 2026-09-30\n')
assert.equal(parseEntry(noBody, 'f')?.body, '')

// parse: meta block stops at the first non-meta line; ids normalized; CRLF ok
assert.equal(parseEntry('# e2: S\r\n**Type:** gotcha\r\n\r\n**Type:** decision', 'f')?.type, 'gotcha')
assert.equal(parseEntry('# e2: S\n**Type:** gotcha\n', 'f')?.id, 'E002')

// parse rejects: no H1, no type, unknown type
assert.equal(parseEntry('**Type:** convention\n', 'f'), null)
assert.equal(parseEntry('# E001: S\n\nbody', 'f'), null)
assert.equal(parseEntry('# E001: S\n**Type:** rule\n', 'f'), null)
assert.equal(parseEntry('# Notes\n**Type:** convention\n', 'f'), null)

// validateEntryInput
assert.equal(validateEntryInput({ type: 'convention', summary: 'ok' }), null)
assert.equal(validateEntryInput({ id: 'e1', type: 'preference', summary: 'ok', body: 'b' }), null)
assert.match(validateEntryInput({ type: 'rule', summary: 'x' }) ?? '', /convention, gotcha, decision, preference/)
assert.match(validateEntryInput({ type: 'convention', summary: '  ' }) ?? '', /required/)
assert.match(validateEntryInput({ type: 'convention', summary: 'a\nb' }) ?? '', /one line/)
assert.match(validateEntryInput({ type: 'convention', summary: 'x'.repeat(121) }) ?? '', /120/)
assert.match(validateEntryInput({ id: 'T1', type: 'convention', summary: 'x' }) ?? '', /Invalid id/)
assert.match(validateEntryInput({ type: 'convention', summary: 'x', body: 5 as unknown as string }) ?? '', /body/)

console.log('entries: ok')
