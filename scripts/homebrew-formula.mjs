#!/usr/bin/env node
// Renders the Homebrew formula for a published npm version: node scripts/homebrew-formula.mjs <version> <out.rb>
// The release workflow pushes the result to github.com/quanghoangf/homebrew-vibedoc (Formula/vibedoc.rb).
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TEMPLATE = new URL('../packaging/homebrew/vibedoc.rb.tmpl', import.meta.url)

export function renderFormula(template, version, sha256) {
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) throw new Error(`not a version: ${version}`)
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`not a sha256: ${sha256}`)
  return template.replaceAll('{{version}}', version).replaceAll('{{sha256}}', sha256)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, out] = process.argv.slice(2)
  if (!version || !out) {
    console.error('usage: node scripts/homebrew-formula.mjs <version> <out.rb>')
    process.exit(1)
  }
  const url = `https://registry.npmjs.org/vibedoc/-/vibedoc-${version}.tgz`
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`${url} → ${res.status}`)
    process.exit(1)
  }
  const sha256 = createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex')
  writeFileSync(out, renderFormula(readFileSync(TEMPLATE, 'utf8'), version, sha256))
  console.log(`${out}: vibedoc ${version} (sha256 ${sha256})`)
}
