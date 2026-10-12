// node src/lib/mermaid-error.check.mts
import assert from 'node:assert/strict'
import { explainMermaidError } from './mermaid-error.ts'

const parse = (got: string, line = 2) => new Error(`Parse error on line ${line}:\n...A --> -->\n-----------^\nExpecting 'AMP', 'COLON', 'PIPE', got '${got}'`)

assert.deepEqual({ ...explainMermaidError(parse('LINK')), raw: '' }, { line: 2, kind: 'arrow', raw: '' })
assert.equal(explainMermaidError(parse('EOF', 3)).kind, 'end')
assert.equal(explainMermaidError(parse('EOF', 3)).line, 3)
assert.equal(explainMermaidError(parse('SQS')).kind, 'other')
assert.deepEqual({ ...explainMermaidError(new Error('Lexical error on line 4. Unrecognized text.\n...')), raw: '' }, { line: 4, kind: 'text', raw: '' })
assert.deepEqual({ ...explainMermaidError(new Error('No diagram type detected matching given configuration for text: flowhcart')), raw: '' }, { line: 1, kind: 'type', raw: '' })
// the raw message is kept whole for Details; non-Error values still read
assert.match(explainMermaidError(parse('LINK')).raw, /^Parse error on line 2:\n[\s\S]*got 'LINK'$/)
assert.deepEqual(explainMermaidError('boom'), { line: null, kind: 'other', raw: 'boom' })
assert.deepEqual(explainMermaidError(undefined), { line: null, kind: 'other', raw: '' })

console.log('mermaid-error: ok')
