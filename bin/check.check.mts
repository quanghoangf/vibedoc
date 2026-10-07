// Self-check for `vibedoc check` (R090), run the way the sample CI workflow runs it: through bin/vibedoc.mjs, in a
// plain folder, no server. Needs the bundle: pnpm build:cli && node bin/check.check.mts
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vibedoc.mjs')
const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-check-'))
const check = (...args: string[]) => spawnSync(process.execPath, [bin, 'check', ...args], { cwd: root, encoding: 'utf8', timeout: 30_000 })

try {
  mkdirSync(path.join(root, 'docs'))
  writeFileSync(path.join(root, 'README.md'), '# Demo\n\nSee [the guide](docs/guide.md).\n')
  writeFileSync(path.join(root, 'docs/guide.md'), '# Guide\n\nSetup is in [setup](setup.md).\n')

  // S1: a broken link fails, from the cwd, with path, line and rule
  let r = check()
  assert.equal(r.status, 1, r.stderr)
  assert.match(r.stdout, /1 error/)
  assert.match(r.stdout, /docs\/guide\.md/)
  assert.match(r.stdout, /L3 error broken-link/)

  // S3: --json + --root from elsewhere, same exit code
  r = spawnSync(process.execPath, [bin, 'check', '--json', '--root', root], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(r.status, 1, r.stderr)
  const lint = JSON.parse(r.stdout)
  assert.equal(lint.files, 2)
  assert.equal(lint.errors, 1)
  assert.deepEqual(lint.issues.filter((i: { level: string }) => i.level === 'error').map((i: { path: string; rule: string; line: number }) => [i.path, i.rule, i.line]), [['docs/guide.md', 'broken-link', 3]])

  // S2: fixed → exit 0 (warnings don't fail)
  writeFileSync(path.join(root, 'docs/setup.md'), '# Setup\n\nBack to [the guide](guide.md).\n')
  r = check()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /no issues in 3 files|0 errors/)
  r = check('--json')
  assert.equal(r.status, 0)
  assert.equal(JSON.parse(r.stdout).errors, 0)

  // bad arguments / root → exit 2, never starts the app
  assert.equal(check('--nope').status, 2)
  assert.equal(check('--root', path.join(root, 'missing')).status, 2)

  console.log('bin/check.check.mts: ok')
} finally {
  rmSync(root, { recursive: true, force: true })
}
