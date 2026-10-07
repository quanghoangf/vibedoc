// node src/lib/md-code-tabs.check.mts
import assert from 'node:assert/strict'
import { Marked } from 'marked'
import { codeTabsExtension, fenceTitle, groupFences } from './md-code-tabs.ts'

assert.equal(fenceTitle('bash title="pnpm"'), 'pnpm')
assert.equal(fenceTitle("bash title='npm i'"), 'npm i')
assert.equal(fenceTitle('title=yarn'), 'yarn')
assert.equal(fenceTitle('bash'), null)
assert.equal(fenceTitle(undefined), null)
assert.equal(fenceTitle('bash subtitle="x"'), null)

const md = new Marked({ gfm: true })
md.use({ extensions: [codeTabsExtension], hooks: { processAllTokens: groupFences } })
const html = (s: string) => md.parse(s) as string
const fence = (title: string | null, body: string, lang = 'bash') => `\`\`\`${lang}${title === null ? '' : ` title="${title}"`}\n${body}\n\`\`\`\n`
const groups = (s: string) => (s.match(/data-code-group/g) ?? []).length

// two titled fences with a blank line between → one group, first tab selected, second panel hidden
const two = html(`Intro\n\n${fence('pnpm', 'pnpm add x')}\n${fence('npm', 'npm i x')}\nAfter\n`)
assert.equal(groups(two), 1)
assert.match(two, /<button type="button" role="tab" aria-selected="true" tabindex="0">pnpm<\/button><button type="button" role="tab" aria-selected="false" tabindex="-1">npm<\/button>/)
assert.match(two, /<div role="tabpanel" tabindex="0"><pre><code class="language-bash">pnpm add x\n<\/code><\/pre>\n<\/div><div role="tabpanel" tabindex="0" hidden><pre><code class="language-bash">npm i x/)
assert.match(two, /^<p>Intro<\/p>\n<div class="md-code-group"/)
assert.match(two, /<\/div>\n<p>After<\/p>/)

// directly adjacent fences group too; three make three tabs
assert.equal((html(fence('a', '1') + fence('b', '2') + fence('c', '3')).match(/role="tab"/g) ?? []).length, 3)

// a single titled fence, or an untitled neighbour, stays a plain code block
assert.equal(groups(html(fence('pnpm', 'x'))), 0)
assert.equal(groups(html(`${fence('pnpm', 'x')}\n${fence(null, 'y')}`)), 0)
assert.equal(groups(html(`${fence('pnpm', 'x')}\nText\n\n${fence('npm', 'y')}`)), 0)
assert.equal(html(fence(null, 'plain')), '<pre><code class="language-bash">plain\n</code></pre>\n')

// the title is escaped; the title never leaks into the code's language class
const evil = html(fence('<b>&x</b>', '1') + fence("it's", '2'))
assert.match(evil, /role="tab"[^>]*>&lt;b&gt;&amp;x&lt;\/b&gt;<\/button>/)
assert.match(evil, />it's<\/button>/)
assert.doesNotMatch(evil, /title=/)

// a group mid-doc leaves the blocks around it in order
const mid = html(`# H\n\n${fence('a', '1')}${fence('b', '2')}\n- item\n`)
assert.match(mid, /<h1>H<\/h1>\n<div class="md-code-group"[\s\S]*<\/div>\n<ul>\n<li>item<\/li>/)

console.log('md-code-tabs ok')
