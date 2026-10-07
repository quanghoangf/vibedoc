// Self-check for `vibedoc --demo`'s throwaway copy (R085). Run: node bin/demo.check.mts
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DEMO_MARKER, DEMO_PREFIX, DEMO_SOURCE, prepareDemo, sweepDemos } from './demo.mjs'

const base = mkdtempSync(path.join(tmpdir(), 'vibedoc-demo-check-'))
try {
  const demo = prepareDemo({ base })
  assert.equal(path.basename(demo.root), 'listly', 'the copy is named listly')
  assert.ok(path.basename(demo.dir).startsWith(DEMO_PREFIX))
  assert.ok(existsSync(path.join(demo.root, 'plans/roadmap')), 'the roadmap is copied')
  assert.equal(path.dirname(demo.runsDir), demo.dir, 'runs live next to the copy, inside the temp dir')
  writeFileSync(path.join(demo.root, 'plans/tasks/T999-edit.md'), '# T999: edit\n')
  demo.cleanup()
  assert.ok(!existsSync(demo.dir), 'cleanup removes the temp dir')
  const status = execFileSync('git', ['status', '--porcelain', DEMO_SOURCE], { encoding: 'utf8' })
  assert.equal(status, '', 'the source sample is unchanged')

  // Sweep: old marked demo dirs go; fresh ones, unmarked ones and other folders stay
  const old = prepareDemo({ base }).dir
  const fresh = prepareDemo({ base }).dir
  const unmarked = path.join(base, DEMO_PREFIX + 'unmarked')
  const other = path.join(base, 'something-else')
  mkdirSync(unmarked); mkdirSync(other); writeFileSync(path.join(other, DEMO_MARKER), '')
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  for (const d of [old, unmarked, other]) utimesSync(d, twoDaysAgo, twoDaysAgo)
  assert.deepEqual(sweepDemos({ base }), [old])
  assert.ok(!existsSync(old) && existsSync(fresh) && existsSync(unmarked) && existsSync(other))
} finally {
  rmSync(base, { recursive: true, force: true })
}
console.log('demo.check: ok')
