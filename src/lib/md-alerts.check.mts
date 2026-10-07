// node src/lib/md-alerts.check.mts
import assert from 'node:assert/strict'
import { Marked } from 'marked'
import { ALERT_KINDS, alertExtension } from './md-alerts.ts'

const md = new Marked({ gfm: true })
md.use({ extensions: [alertExtension] })
const html = (s: string) => md.parse(s) as string

for (const kind of ALERT_KINDS) {
  const out = html(`> [!${kind.toUpperCase()}]\n> Body **bold**\n`)
  assert.match(out, new RegExp(`<div class="md-alert" data-alert="${kind}" role="note"><p class="md-alert-title">${kind[0].toUpperCase()}${kind.slice(1)}</p>`))
  assert.match(out, /<p>Body <strong>bold<\/strong><\/p>/)
  assert.doesNotMatch(out, /blockquote|\[!/)
}

// case-insensitive marker
assert.match(html('> [!warning]\n> x\n'), /data-alert="warning"/)

// unknown kind and text on the marker line stay a plain blockquote (GitHub's rule)
assert.match(html('> [!DANGER]\n> x\n'), /^<blockquote>/)
assert.match(html('> [!NOTE] inline text\n> x\n'), /^<blockquote>/)
assert.match(html('> plain quote\n'), /^<blockquote>/)

// block markdown inside: list, code, multiple paragraphs
const nested = html('> [!TIP]\n> - one\n> - two\n>\n> ```js\n> a < b\n> ```\n>\n> Last.\n')
assert.match(nested, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/)
assert.match(nested, /<pre><code class="language-js">a &lt; b\n<\/code><\/pre>/)
assert.match(nested, /<p>Last.<\/p>\n<\/div>/)

// the alert ends at the first line without `>`; what follows is a normal paragraph
const after = html('Intro\n\n> [!NOTE]\n> inside\n\nOutside\n')
assert.match(after, /^<p>Intro<\/p>\n<div class="md-alert"/)
assert.match(after, /<\/div>\n<p>Outside<\/p>/)

// two alerts back to back
assert.equal((html('> [!NOTE]\n> a\n\n> [!CAUTION]\n> b\n').match(/class="md-alert"/g) ?? []).length, 2)

console.log('md-alerts ok')
