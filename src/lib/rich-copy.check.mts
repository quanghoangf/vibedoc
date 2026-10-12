// node src/lib/rich-copy.check.mts
import assert from 'node:assert/strict'
import { PASTE_PALETTE, visualBlockToHtml } from './rich-copy.ts'

const p = { ...PASTE_PALETTE, accent: '#7c6af7' }
const items = [
  { icon: '🎯', title: 'Focus', body: 'One goal <code>a</code>', detail: '<p>Example</p>' },
  { title: 'Queue', body: 'Asks wait', detail: '' },
  { title: 'Now', body: 'Building', detail: '', now: true },
]

for (const kind of ['steps', 'cards', 'compare', 'timeline']) {
  const html = visualBlockToHtml(kind, items, p)
  assert.doesNotMatch(html, /class=/, `${kind}: no classes (paste targets drop stylesheets)`)
  assert.doesNotMatch(html, /var\(--/, `${kind}: colours are literals`)
  assert.match(html, /^<table style="font-family:/, `${kind}: one table`)
  assert.match(html, /Asks wait/)
  assert.match(html, /One goal <code>a<\/code>/, `${kind}: the rendered inline markup is kept`)
}
// steps: 3 cards, 2 arrows; icon escaped text before the title
const steps = visualBlockToHtml('steps', items, p)
assert.equal((steps.match(/↓/g) ?? []).length, 2)
assert.equal((steps.match(/border:1px solid #e0e0ee/g) ?? []).length, 3)
assert.match(steps, />🎯 Focus</)
// cards: 2 per row, an odd last one padded
const cards = visualBlockToHtml('cards', items, p)
assert.equal((cards.match(/<tr>/g) ?? []).length, 2)
assert.match(cards, /<td><\/td><\/tr><\/table>$/)
// compare: one row, equal widths
assert.match(visualBlockToHtml('compare', items.slice(0, 2), p), /^<table[^>]*><tr><td style="[^"]*width:50%/)
// timeline: label column, the accent only on "now"
const tl = visualBlockToHtml('timeline', items, p)
assert.equal((tl.match(/color:#7c6af7/g) ?? []).length, 1)
assert.match(tl, /● Now/)
assert.doesNotMatch(tl, /🎯/, 'the label column carries the title, the icon is dropped there')
// titles are HTML from the renderer (not re-escaped); an icon is text (escaped)
assert.match(visualBlockToHtml('cards', [{ icon: '<b>', title: 'a &amp; b', body: '', detail: '' }], p), />&lt;b&gt; a &amp; b</)

console.log('rich-copy: ok')
