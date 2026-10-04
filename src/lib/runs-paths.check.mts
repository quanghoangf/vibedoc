// Self-check: run artifact paths. Run: node src/lib/runs-paths.check.mts
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { newRunId, projectKey, runDir, runsRoot, slug, stepFile } from './runs-paths.ts'

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

console.log('runs-paths ok')
