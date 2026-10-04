// Self-check for `vibedoc --version` / `-v`. Run: node bin/vibedoc.check.mts
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const binDir = path.dirname(fileURLToPath(import.meta.url))
const bin = path.join(binDir, 'vibedoc.mjs')
const { version } = JSON.parse(readFileSync(path.join(binDir, '..', 'package.json'), 'utf8'))

// Run from a temp project with its own package.json: must still print VibeDoc's version
const cwd = mkdtempSync(path.join(tmpdir(), 'vibedoc-version-'))
writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'other', version: '9.9.9' }))
try {
  for (const flag of ['--version', '-v']) {
    const r = spawnSync(process.execPath, [bin, flag], { cwd, encoding: 'utf8', timeout: 10_000 })
    assert.equal(r.status, 0, `${flag} exits 0`)
    assert.equal(r.stdout, `${version}\n`, `${flag} prints only the version`)
  }
} finally {
  rmSync(cwd, { recursive: true, force: true })
}
console.log('vibedoc.check: ok')
