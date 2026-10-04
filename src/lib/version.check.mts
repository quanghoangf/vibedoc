// Self-check: VIBEDOC_VERSION is package.json's version. Run: node src/lib/version.check.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIBEDOC_VERSION } from './version.ts'

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
assert.equal(VIBEDOC_VERSION, version)
assert.match(VIBEDOC_VERSION, /^\d+\.\d+\.\d+/)
console.log('version.check: ok')
