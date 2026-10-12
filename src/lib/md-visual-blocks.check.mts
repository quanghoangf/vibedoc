// node src/lib/md-visual-blocks.check.mts
import assert from 'node:assert/strict'
import { Marked } from 'marked'
import { groupVisualBlocks, renderedKind, splitItem, visualBlocksExtension } from './md-visual-blocks.ts'

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

// marker + list → one block: three cards, each with its drawn number, ordered list semantics kept
const steps = html(STEPS)
assert.equal(blocks(steps), 1)
assert.match(steps, /^<div class="md-visual" data-visual="steps" data-source="&lt;!-- vibedoc:steps --&gt;\n1\. \*\*Focus\*\* — One main goal at a time\.\n {3}Example: finish the transaction flow\.\n2\. [^"]*Small and often\."><ol role="list"><li><span class="md-visual-num" aria-hidden="true">1<\/span><div class="md-visual-card">/)
assert.equal((steps.match(/class="md-visual-card"/g) ?? []).length, 3)
assert.deepEqual([...steps.matchAll(/class="md-visual-num" aria-hidden="true">(\d+)</g)].map((m) => m[1]), ['1', '2', '3'])
assert.match(html('<!-- vibedoc:steps -->\n4. **a**\n5. **b**\n'), /<ol role="list" start="4"><li><span class="md-visual-num" aria-hidden="true">4</)
assert.match(steps, /<strong class="md-visual-title">Focus<\/strong><div class="md-visual-body">One main goal at a time.<\/div><div class="md-visual-detail"><p>Example: finish the transaction flow.<\/p>\n<\/div>/)
assert.doesNotMatch(steps, /<!--/)

// a blank line between marker and list still groups; cards are a <ul> without numbers
const cards = html('<!-- vibedoc:cards -->\n\n- **🧭 Map** see it\n- **Docs** read it\n')
assert.equal(blocks(cards), 1)
assert.match(cards, /data-visual="cards" data-source="[^"]*"><ul role="list">/)
assert.match(cards, /<span class="md-visual-icon">🧭<\/span><strong class="md-visual-title">Map<\/strong>/)
assert.doesNotMatch(cards, /md-visual-num/)

// a marker with no list → nothing; unknown or not-yet-rendered kinds → the plain list
assert.equal(blocks(html('<!-- vibedoc:steps -->\n\nJust text.\n')), 0)
assert.equal(html('<!-- vibedoc:nope -->\n- a\n'), '<!-- vibedoc:nope -->\n<ul>\n<li>a</li>\n</ul>\n')
// compare: 2–3 columns, each item's nested list kept as its points; more than 3 → cards
const cmp = html('<!-- vibedoc:compare -->\n- **Option A** — fast\n  - no build step\n  - less control\n- **Option B** — flexible\n  - full control\n')
assert.match(cmp, /data-visual="compare" data-source="[^"]*"><ul role="list">/)
assert.equal((cmp.match(/class="md-visual-card"/g) ?? []).length, 2)
assert.match(cmp, /<div class="md-visual-detail"><ul>\n<li>no build step<\/li>\n<li>less control<\/li>\n<\/ul>/)
assert.match(html('<!-- vibedoc:compare -->\n- a\n- b\n- c\n- d\n'), /data-visual="cards"/)
assert.equal(renderedKind('compare', 3), 'compare')
assert.equal(renderedKind('compare', 4), 'cards')
assert.equal(renderedKind('steps', 9), 'steps')

// timeline: a dot per item; label = title, body + detail beside it; only a "now" item is marked
const tl = html('<!-- vibedoc:timeline -->\n1. **2026 Q3** — shipped R089\n2. **Now** — R096 visual docs\n   in review\n3. **Later** — R097\n4. **Snowfall** — not now-ish\n')
assert.match(tl, /data-visual="timeline" data-source="[^"]*"><ol role="list">/)
assert.equal((tl.match(/class="md-visual-dot"/g) ?? []).length, 4)
assert.equal((tl.match(/<li data-now>/g) ?? []).length, 1, 'only the item titled Now (Snowfall does not count)')
assert.match(tl, /<li data-now><span class="md-visual-dot" aria-hidden="true"><\/span><div class="md-visual-card"><strong class="md-visual-title">Now<\/strong><div class="md-visual-body">R096 visual docs<\/div><div class="md-visual-detail"><p>in review<\/p>/)
assert.doesNotMatch(tl, /md-visual-num/)

// lists without a marker render exactly as before
const plain = new Marked({ gfm: true })
for (const s of ['- a\n- b\n', '1. **x** y\n2. z\n', '- [ ] todo\n- [x] done\n', '- a\n  - nested\n']) assert.equal(html(s), plain.parse(s))

// data-source is the block's markdown, attribute-escaped
assert.match(html('<!-- vibedoc:cards -->\n- **a "q" <b>** x\n'), /data-source="&lt;!-- vibedoc:cards --&gt;\n- \*\*a &quot;q&quot; &lt;b&gt;\*\* x"/)

// inline markdown still works; HTML-ish text is escaped
const inl = html('<!-- vibedoc:cards -->\n- **a < b & c** see [docs](x.md) and `code`\n')
assert.match(inl, /<strong class="md-visual-title">a &lt; b &amp; c<\/strong>/)
assert.match(inl, /<a href="x.md">docs<\/a> and <code>code<\/code>/)

// a block mid-doc leaves the blocks around it in order; a start number is kept
const mid = html(`# H\n\n${STEPS.replace('1. **Focus**', '4. **Focus**').replace('2. **Queue**', '5. **Queue**').replace('3. **Ship**', '6. **Ship**')}\nAfter\n`)
assert.match(mid, /^<h1>H<\/h1>\n<div class="md-visual" data-visual="steps" data-source="[^"]*"><ol role="list" start="4">[\s\S]*<\/ol><\/div>\n<p>After<\/p>\n$/)

console.log('md-visual-blocks ok')
