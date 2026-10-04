// Self-check: run artifact paths. Run: node src/lib/runs-paths.check.mts
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { isRunFile, isRunId, isRunTaskId, newRunId, parseRange, parseRunManifest, projectKey, runDir, runsRoot, slug, stepFile } from './runs-paths.ts'

// Slugs
assert.equal(slug('Open /board → board loads'), 'open-board-board-loads')
assert.equal(slug('  --Hello, World!--  '), 'hello-world')
assert.equal(slug('x'.repeat(80)).length, 60)
assert.equal(slug('a'.repeat(59) + ' b'), 'a'.repeat(59), 'no trailing dash after the cut')
assert.equal(slug('→ ✓'), '')
assert.equal(stepFile(1, 'Open /board → board loads'), '01-open-board-board-loads.png')
assert.equal(stepFile(12, '!!!'), '12-step.png')
assert.equal(projectKey('/work/My App'), 'my-app')
assert.equal(projectKey('/work/vibedoc/'), 'vibedoc')

// runId: compact UTC, sorts like time
assert.equal(newRunId(new Date('2026-10-04T10:15:00.123Z')), '20261004T101500Z')
const ids = ['2026-10-04T10:15:00Z', '2026-10-04T09:59:59Z', '2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z']
  .map(d => newRunId(new Date(d)))
assert.deepEqual([...ids].sort(), [ids[1], ids[0], ids[2], ids[3]])

// Env override
assert.equal(runsRoot({}), path.join(os.homedir(), '.vibedoc', 'runs'))
assert.equal(runsRoot({ VIBEDOC_RUNS_DIR: '/tmp/r' }), '/tmp/r')
assert.equal(runDir('vibedoc', 'T138', '20261004T101500Z', { VIBEDOC_RUNS_DIR: '/tmp/r' }), '/tmp/r/vibedoc/T138/20261004T101500Z')

// Runs API input checks (T151): nothing else gets joined into a path
assert.ok(isRunId('20261004T101500Z'))
for (const bad of ['x', '..', '../20261004T101500Z', '20261004T101500Z/..', '2026-10-04T10:15:00Z']) assert.ok(!isRunId(bad), bad)
assert.ok(isRunFile('video.webm') && isRunFile('01-open-board.png'))
for (const bad of ['../etc', '..%2Fetc', 'run.json', 'a/b.png', '.png', '..png', 'x.PNG', 'x.png.txt', '']) assert.ok(!isRunFile(bad), bad)
assert.ok(isRunTaskId('T138') && !isRunTaskId('..') && !isRunTaskId('t138') && !isRunTaskId('T1/..'))

// run.json parsing
assert.equal(parseRunManifest('{'), null)
assert.equal(parseRunManifest('{"runId":"x","status":"passed","steps":[]}'), null)
assert.equal(parseRunManifest('{"runId":"20261004T101500Z","status":"passed"}'), null)
assert.equal(parseRunManifest('{"runId":"20261004T101500Z","status":"passed","steps":[]}')?.runId, '20261004T101500Z')

// Range
assert.equal(parseRange(null, 100), null)
assert.equal(parseRange('bytes=0-1,5-6', 100), null)
assert.equal(parseRange('items=0-1', 100), null)
assert.deepEqual(parseRange('bytes=0-1', 100), { start: 0, end: 1 })
assert.deepEqual(parseRange('bytes=10-', 100), { start: 10, end: 99 })
assert.deepEqual(parseRange('bytes=90-500', 100), { start: 90, end: 99 })
assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 })
assert.deepEqual(parseRange('bytes=-500', 100), { start: 0, end: 99 })
assert.equal(parseRange('bytes=100-', 100), 'unsatisfiable')
assert.equal(parseRange('bytes=5-2', 100), 'unsatisfiable')
assert.equal(parseRange('bytes=-0', 100), 'unsatisfiable')

console.log('runs-paths ok')
