// Self-check for entries-export. Run: node src/lib/entries-export.check.mts
import assert from 'node:assert/strict'
import { BLOCK_END, BLOCK_START, TYPE_HEADINGS, renderEntriesBlock, upsertManagedBlock } from './entries-export.ts'
import { ENTRY_TYPES, type Entry } from './entries.ts'

const e = (id: string, type: Entry['type'], summary: string, body = ''): Entry =>
  ({ id, type, summary, body, updatedAt: '2026-10-01', by: null, file: `memory/entries/${id}-x.md` })

// heading order follows ENTRY_TYPES
assert.deepEqual(Object.keys(TYPE_HEADINGS), [...ENTRY_TYPES])

// rendering: grouped by type in ENTRY_TYPES order, sorted by id (numeric), empty groups skipped
const block = renderEntriesBlock([
  e('E010', 'convention', 'Ten'),
  e('E002', 'decision', 'Use pnpm', '\n\n  First line.  \nSecond line.'),
  e('E003', 'convention', 'Only core.ts touches fs', 'API routes import from core, never `fs`.'),
])
assert.equal(block, [
  BLOCK_START,
  '## Project memory',
  '_Generated from memory/entries/ by VibeDoc. Edit the entries, not this block._',
  '',
  '### Conventions',
  '- Only core.ts touches fs: API routes import from core, never `fs`. (E003)',
  '- Ten (E010)',
  '',
  '### Decisions',
  '- Use pnpm: First line. (E002)',
  BLOCK_END,
].join('\n'))
assert.ok(!block.includes('Gotchas') && !block.includes('Preferences'))

// first-line cut at 200 chars; CRLF body
assert.equal(renderEntriesBlock([e('E001', 'gotcha', 'S', 'x'.repeat(250) + '\nmore')]).split('\n')[5], `- S: ${'x'.repeat(200)} (E001)`)
assert.ok(renderEntriesBlock([e('E001', 'gotcha', 'S', 'one\r\ntwo')]).includes('- S: one (E001)'))

// zero entries
assert.ok(renderEntriesBlock([]).includes('\n\n_No entries yet._\n' + BLOCK_END))

const ok = (r: ReturnType<typeof upsertManagedBlock>) => { assert.ok('text' in r, JSON.stringify(r)); return r.text }
const B = renderEntriesBlock([])

// insert: empty file → only the block
assert.equal(ok(upsertManagedBlock('', B)), B + '\n')
// insert: after one blank line, whatever the file's trailing newlines
assert.equal(ok(upsertManagedBlock('# Agents\nhi', B)), '# Agents\nhi\n\n' + B + '\n')
assert.equal(ok(upsertManagedBlock('# Agents\nhi\n', B)), '# Agents\nhi\n\n' + B + '\n')
assert.equal(ok(upsertManagedBlock('# Agents\nhi\n\n', B)), '# Agents\nhi\n\n' + B + '\n')

// replace: text outside the markers untouched, idempotent
const before = '# Agents\n\nintro\n\n' + B + '\n\n## After\ntail'
const B2 = renderEntriesBlock([e('E001', 'convention', 'New')])
const replaced = ok(upsertManagedBlock(before, B2))
assert.equal(replaced, '# Agents\n\nintro\n\n' + B2 + '\n\n## After\ntail')
assert.equal(ok(upsertManagedBlock(replaced, B2)), replaced)

// CRLF: inserted / replaced block uses CRLF, outside bytes untouched, no bare \n
const crlf = '# Claude\r\n\r\nrules\r\n'
const ins = ok(upsertManagedBlock(crlf, B2))
assert.ok(ins.startsWith(crlf + '\r\n' + BLOCK_START))
assert.ok(!/[^\r]\n/.test(ins))
const rep = ok(upsertManagedBlock(ins + 'tail\r\n', B))
assert.equal(rep, crlf + '\r\n' + B.replace(/\n/g, '\r\n') + '\r\ntail\r\n')

// one marker (or reversed) → error
for (const broken of [`x\n${BLOCK_START}\ny`, `x\n${BLOCK_END}\ny`, `${BLOCK_END}\n${BLOCK_START}`]) {
  const r = upsertManagedBlock(broken, B)
  assert.ok('error' in r && r.error.length > 0)
}

// a marker inside an entry line never closes the block: re-export settles
const tricky = renderEntriesBlock([e('E001', 'gotcha', 'Markers', `Ends at \`${BLOCK_END}\` and \`${BLOCK_START}\``)])
const once = ok(upsertManagedBlock('# Agents\n', tricky))
assert.equal(ok(upsertManagedBlock(once, tricky)), once)
assert.equal(ok(upsertManagedBlock(ok(upsertManagedBlock(once, B)), tricky)), once)

// a marker quoted in prose / a code span before the block is left alone
const prose = `# Claude\n\nThe block starts at \`${BLOCK_START}\` and ends at ${BLOCK_END}.\n\n`
assert.equal(ok(upsertManagedBlock(prose + B + '\ntail\n', B2)), prose + B2 + '\ntail\n')
// only quoted (never a whole line) → no block yet, append
assert.equal(ok(upsertManagedBlock(prose, B)), prose + B + '\n')

console.log('entries-export: ok')
