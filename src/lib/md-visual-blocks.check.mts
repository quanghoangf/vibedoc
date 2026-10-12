// node src/lib/md-visual-blocks.check.mts
import assert from 'node:assert/strict'
import { Marked } from 'marked'
import { groupVisualBlocks, splitItem, visualBlocksExtension } from './md-visual-blocks.ts'

// splitItem: bold title (+ emoji icon), rest of the first line = body, following lines = detail
assert.deepEqual(splitItem('**Focus** — One main goal at a time.\nExample: finish the transaction flow.'),
  { title: 'Focus', body: 'One main goal at a time.', detail: 'Example: finish the transaction flow.' })
assert.deepEqual(splitItem('**🎯 Focus**: goal'), { icon: '🎯', title: 'Focus', body: 'goal', detail: '' })
assert.deepEqual(splitItem('**Queue** new asks'), { title: 'Queue', body: 'new asks', detail: '' })
assert.deepEqual(splitItem('**Only title**'), { title: 'Only title', body: '', detail: '' })
assert.deepEqual(splitItem('plain text\n\nmore'), { title: '', body: 'plain text', detail: 'more' })

const md = new Marked({ gfm: true })
md.use({ extensions: [visualBlocksExtension], hooks: { processAllTokens: groupVisualBlocks } })
const html = (s: string) => md.parse(s) as string
const blocks = (s: string) => (s.match(/class="md-visual"/g) ?? []).length
const STEPS = '<!-- vibedoc:steps -->\n1. **Focus** — One main goal at a time.\n   Example: finish the transaction flow.\n2. **Queue** — New asks go to a queue.\n3. **Ship** — Small and often.\n'

// marker + list → one block: three cards, two arrows, ordered list semantics kept
const steps = html(STEPS)
assert.equal(blocks(steps), 1)
assert.match(steps, /^<div class="md-visual" data-visual="steps"><ol role="list"><li><div class="md-visual-card">/)
assert.equal((steps.match(/class="md-visual-card"/g) ?? []).length, 3)
assert.equal((steps.match(/class="md-visual-arrow"/g) ?? []).length, 2)
assert.match(steps, /<strong class="md-visual-title">Focus<\/strong><div class="md-visual-body">One main goal at a time.<\/div><div class="md-visual-detail"><p>Example: finish the transaction flow.<\/p>\n<\/div>/)
assert.doesNotMatch(steps, /<!--/)

// a blank line between marker and list still groups; cards are a <ul> without arrows
const cards = html('<!-- vibedoc:cards -->\n\n- **🧭 Map** see it\n- **Docs** read it\n')
assert.equal(blocks(cards), 1)
assert.match(cards, /data-visual="cards"><ul role="list">/)
assert.match(cards, /<span class="md-visual-icon">🧭<\/span><strong class="md-visual-title">Map<\/strong>/)
assert.doesNotMatch(cards, /md-visual-arrow/)

// a marker with no list → nothing; unknown or not-yet-rendered kinds → the plain list
assert.equal(blocks(html('<!-- vibedoc:steps -->\n\nJust text.\n')), 0)
assert.equal(html('<!-- vibedoc:nope -->\n- a\n'), '<!-- vibedoc:nope -->\n<ul>\n<li>a</li>\n</ul>\n')
assert.equal(blocks(html('<!-- vibedoc:timeline -->\n- a\n')), 0)
// lists without a marker render exactly as before
const plain = new Marked({ gfm: true })
for (const s of ['- a\n- b\n', '1. **x** y\n2. z\n', '- [ ] todo\n- [x] done\n', '- a\n  - nested\n']) assert.equal(html(s), plain.parse(s))

// inline markdown still works; HTML-ish text is escaped
const inl = html('<!-- vibedoc:cards -->\n- **a < b & c** see [docs](x.md) and `code`\n')
assert.match(inl, /<strong class="md-visual-title">a &lt; b &amp; c<\/strong>/)
assert.match(inl, /<a href="x.md">docs<\/a> and <code>code<\/code>/)

// a block mid-doc leaves the blocks around it in order; a start number is kept
const mid = html(`# H\n\n${STEPS.replace('1. **Focus**', '4. **Focus**').replace('2. **Queue**', '5. **Queue**').replace('3. **Ship**', '6. **Ship**')}\nAfter\n`)
assert.match(mid, /^<h1>H<\/h1>\n<div class="md-visual" data-visual="steps"><ol role="list" start="4">[\s\S]*<\/ol><\/div>\n<p>After<\/p>\n$/)

console.log('md-visual-blocks ok')
