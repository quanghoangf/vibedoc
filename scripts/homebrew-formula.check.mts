// node scripts/homebrew-formula.check.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderFormula } from './homebrew-formula.mjs'

const tmpl = readFileSync(new URL('../packaging/homebrew/vibedoc.rb.tmpl', import.meta.url), 'utf8')
const sha = 'a'.repeat(64)
const rb = renderFormula(tmpl, '1.14.0', sha)
assert.match(rb, /url "https:\/\/registry\.npmjs\.org\/vibedoc\/-\/vibedoc-1\.14\.0\.tgz"/)
assert.match(rb, new RegExp(`sha256 "${sha}"`))
assert.doesNotMatch(rb, /\{\{/)
assert.throws(() => renderFormula(tmpl, 'v1.14', sha))
assert.throws(() => renderFormula(tmpl, '1.14.0', 'nope'))
console.log('homebrew-formula: ok')
