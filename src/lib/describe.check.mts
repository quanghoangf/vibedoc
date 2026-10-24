// node src/lib/describe.check.mts
import assert from 'node:assert/strict'
import { firstProseParagraph, firstProseSentence, inlineParts, plainInline } from './describe.ts'

// frontmatter, comments, headings, badges and HTML are skipped; link syntax keeps its text; first sentence only
assert.equal(
  firstProseSentence('---\ntitle: X\n---\n<!-- agent-only: ignore -->\n# Project memory\n\n<p align="center">\n\nVibeDoc is a [kanban](docs/board.md) and **docs** viewer for agents. It also serves MCP.\n'),
  'VibeDoc is a kanban and docs viewer for agents.',
)
// a multi-line comment and a fenced block never leak in
assert.equal(firstProseSentence('<!--\nlong comment that is not prose at all\n-->\n```ts\n// not this one either, it is code\n```\nThe `core.ts` module owns every file system call.'), 'The core.ts module owns every file system call.')
// code-comment prefixes go (a .md that starts like a source header)
assert.equal(firstProseSentence('// Pure helpers for the doc graph, no React here.\n'), 'Pure helpers for the doc graph, no React here.')
// tables and lists are not prose; the heading is the fallback
assert.equal(firstProseSentence('# API reference\n\n| a | b |\n|---|---|\n- one item that is long enough\n'), 'API reference')
// a wrapped paragraph joins its lines; a long sentence is capped
assert.equal(firstProseSentence('This paragraph wraps\nonto a second line here.'), 'This paragraph wraps onto a second line here.')
assert.ok(firstProseSentence(`${'word '.repeat(60)}end.`).endsWith('…'))
assert.equal(firstProseSentence(''), '')

assert.equal(plainInline('See [b](x.md), `code`, *em* and snake_case_name'), 'See b, code, em and snake_case_name')

assert.deepEqual(inlineParts('Use `vibedoc check` in **CI**, see [docs](https://x.dev).'), [
  { kind: 'text', text: 'Use ' },
  { kind: 'code', text: 'vibedoc check' },
  { kind: 'text', text: ' in ' },
  { kind: 'strong', text: 'CI' },
  { kind: 'text', text: ', see ' },
  { kind: 'link', text: 'docs', href: 'https://x.dev' },
  { kind: 'text', text: '.' },
])
assert.deepEqual(inlineParts('snake_case_name stays'), [{ kind: 'text', text: 'snake_case_name stays' }])
// the whole first paragraph, not just its first sentence; no heading fallback; capped
assert.equal(firstProseParagraph('# Title\n\nFirst sentence here. Second [one](x.md) too.\n\nNext paragraph.'), 'First sentence here. Second one too.')
assert.equal(firstProseParagraph('# Only a heading\n'), '')
assert.ok(firstProseParagraph(`${'word '.repeat(60)}end.`, 50).endsWith('…'))
console.log('describe ok')
