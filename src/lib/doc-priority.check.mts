// node src/lib/doc-priority.check.mts
import assert from 'node:assert/strict'
import { docPriority, setDocPriority, stripFrontmatter, priorityRank, docProperties, setDocProperty, parsePriority } from './doc-priority.ts'

const plain = '# Title\n\nBody\n'
assert.equal(docPriority(plain), null)

const set = setDocPriority(plain, 'P1')
assert.equal(set, '---\npriority: P1\n---\n\n# Title\n\nBody\n')
assert.equal(docPriority(set), 'P1')
assert.equal(stripFrontmatter(set), plain)

// change keeps other keys and its place; clear round-trips to the original
const other = '---\ntags: api\npriority: P2\n---\n# T\n'
assert.equal(setDocPriority(other, 'P0'), '---\ntags: api\npriority: P0\n---\n# T\n')
assert.equal(setDocPriority(other, null), '---\ntags: api\n---\n# T\n')
assert.equal(setDocPriority(set, null), plain)
assert.equal(setDocPriority(plain, null), plain)

// idempotent: the server and the open editor both apply it
assert.equal(setDocPriority(set, 'P1'), set)

// quoted / lowercase, CRLF
assert.equal(docPriority('---\npriority: "p3"\n---\nx'), 'P3')
const crlf = '# T\r\nx\r\n'
assert.equal(setDocPriority(crlf, 'P2'), '---\r\npriority: P2\r\n---\r\n\r\n# T\r\nx\r\n')
assert.equal(docPriority(setDocPriority(crlf, 'P2')), 'P2')

// a thematic break later in the doc is not frontmatter
assert.equal(docPriority('# T\n---\npriority: P0\n---\n'), null)
assert.equal(stripFrontmatter('# T\n---\n'), '# T\n---\n')

assert.deepEqual(['P2', null, 'P0'].sort((a, b) => priorityRank(a as never) - priorityRank(b as never)), ['P0', 'P2', null])
// generic properties: order, quoting, lists kept untouched
const fm = '---\nowner: ana\ntags:\n  - a\n  - b\ntitle: "Hello: world"\n---\nbody'
assert.deepEqual(docProperties(fm), [{ key: 'owner', value: 'ana' }, { key: 'title', value: 'Hello: world' }])
const added = setDocProperty(fm, 'status', 'in review')
assert.equal(added, '---\nowner: ana\ntags:\n  - a\n  - b\ntitle: "Hello: world"\nstatus: in review\n---\nbody')
assert.equal(docProperties(setDocProperty(fm, 'owner', 'a: b # c')).find(p => p.key === 'owner')?.value, 'a: b # c')
assert.equal(setDocProperty(setDocProperty(plain, 'status', 'yes'), 'status', null), plain)
assert.equal(docProperties(setDocProperty(plain, 'status', 'yes'))[0].value, 'yes')
assert.equal(parsePriority(' p2 '), 'P2')
assert.equal(parsePriority('high'), null)
assert.throws(() => setDocProperty(fm, 'tags', 'x'), /list or map/)
console.log('doc-priority ok')
