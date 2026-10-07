// Self-check for ranked doc search. Run: node src/lib/doc-search.check.mts
import assert from 'node:assert/strict'
import { rankDocs } from './doc-search.ts'
import { tokenize } from './recall.ts'

const files = [
  { path: 'docs/noisy.md', raw: '# Notes\n\nbilling billing\nbilling again\nmore billing\nbilling end\n' },
  { path: 'docs/billing.md', raw: '# Billing webhooks\n\nHow we take money.\n' },
  { path: 'docs/heading.md', raw: '# Payments\n\n## Billing\n\ntext\n' },
  { path: 'docs/none.md', raw: '# Other\n\nnothing here\n' },
  { path: 'docs/fenced.md', raw: '# Code\n\n```\n# billing\n```\n' },
]

// title > heading > body, even when the body repeats the word
const r = rankDocs(files, 'billing webhooks', tokenize)
assert.deepEqual(r.map(x => x.file), ['docs/billing.md', 'docs/heading.md', 'docs/noisy.md', 'docs/fenced.md'])
// shape kept: hits are lines with a query token, max 4, totalHits counts them all
const noisy = r.find(x => x.file === 'docs/noisy.md')!
assert.equal(noisy.totalHits, 4)
assert.equal(noisy.hits.length, 4)
assert.deepEqual(noisy.hits[0], { line: 3, text: 'billing billing' })
// a heading inside a code fence is body text
assert.equal(rankDocs(files, 'billing', tokenize).find(x => x.file === 'docs/fenced.md') !== undefined, true)
// no H1 → the file name is the title
assert.equal(rankDocs([{ path: 'docs/deploy-guide.md', raw: 'text' }, { path: 'docs/x.md', raw: '# X\ndeploy' }], 'deploy', tokenize)[0].file, 'docs/deploy-guide.md')
// no match → nothing; stopword-only query falls back to substring
assert.deepEqual(rankDocs(files, 'zebra', tokenize), [])
assert.deepEqual(rankDocs(files, 'the', tokenize).map(x => x.file), ['docs/none.md'])
assert.equal(rankDocs([{ path: 'a.md', raw: 'is it' }], 'it', tokenize)[0].file, 'a.md')
// limit
assert.equal(rankDocs(files, 'billing', tokenize, 2).length, 2)

console.log('doc-search: ok')
