// Self-check for `vibedoc --demo`'s throwaway copy (R085). Run: node bin/demo.check.mts
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import { DEMO_MARKER, DEMO_PREFIX, DEMO_SOURCE, daysSince, prepareDemo, shiftDates, shiftRunId, sweepDemos } from './demo.mjs'

// shiftDates / daysSince: date-only, ISO timestamps, month and year rollover, ids left alone
assert.equal(shiftDates('**Due:** 2026-10-15', 4), '**Due:** 2026-10-19')
assert.equal(shiftDates('"timestamp": "2026-12-30T08:01:30.000Z"', 3), '"timestamp": "2027-01-02T08:01:30.000Z"')
assert.equal(shiftDates('2026-03-01', -1), '2026-02-28')
assert.equal(shiftDates('T004 · run 20260925T101500Z · evt_demo_001', 30), 'T004 · run 20260925T101500Z · evt_demo_001')
assert.equal(shiftDates('2026-10-15', 0), '2026-10-15')
assert.equal(daysSince('2026-10-03', new Date(2026, 9, 7, 23, 30)), 4)
assert.equal(shiftRunId('20260925T052745Z', 7), '20261002T052745Z')
assert.equal(daysSince('2026-10-03', new Date(2026, 9, 3, 0, 5)), 0)

/** Every file of the sample with its content, to prove a demo never writes to it */
const snapshot = () => readdirSync(DEMO_SOURCE, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
  .map((e) => path.join(e.parentPath, e.name)).sort().map((f) => [f, readFileSync(f, 'utf8')])
const before = snapshot()
const base = mkdtempSync(path.join(tmpdir(), 'vibedoc-demo-check-'))
try {
  const demo = prepareDemo({ base })
  assert.equal(path.basename(demo.root), 'listly', 'the copy is named listly')
  assert.ok(path.basename(demo.dir).startsWith(DEMO_PREFIX))
  assert.ok(existsSync(path.join(demo.root, 'plans/roadmap')), 'the roadmap is copied')
  assert.equal(path.dirname(demo.runsDir), demo.dir, 'runs live next to the copy, inside the temp dir')
  assert.ok(readdirSync(path.join(demo.runsDir, 'listly/T004')).some((n) => /^\d{8}T\d{6}Z$/.test(n)), 'the sample run is copied')
  // Dates move so the sample's anchor day is today (R004 is due 11 days after the anchor)
  const shifted = prepareDemo({ base, now: new Date(2026, 10, 1) })
  assert.match(readFileSync(path.join(shifted.root, 'plans/roadmap/R004-shared-lists.md'), 'utf8'), /\*\*Due:\*\* 2026-11-12/)
  assert.match(readFileSync(path.join(DEMO_SOURCE, 'plans/roadmap/R004-shared-lists.md'), 'utf8'), /\*\*Due:\*\* 2026-10-15/, 'the source keeps its dates')
  const [runId] = readdirSync(path.join(shifted.runsDir, 'listly/T004'))
  assert.match(runId, /^202610\d\dT/, 'the run id moved with the dates')
  assert.equal(JSON.parse(readFileSync(path.join(shifted.runsDir, 'listly/T004', runId, 'run.json'), 'utf8')).runId, runId)
  shifted.cleanup()
  writeFileSync(path.join(demo.root, 'plans/tasks/T999-edit.md'), '# T999: edit\n')
  demo.cleanup()
  assert.ok(!existsSync(demo.dir), 'cleanup removes the temp dir')
  assert.deepEqual(snapshot(), before, 'the source sample is unchanged')

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
