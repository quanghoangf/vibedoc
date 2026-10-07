// Records the demo's evidence run (R085): T004 "Share a list by link" against the static Listly mock, through
// VibeDoc's own Playwright kit, then copies it into examples/demo-runs/listly/ for `vibedoc --demo` to serve.
// A maintainer runs it after changing the mock, the spec or the kit; the output is committed.
//
//   node scripts/demo-run.mjs
import { spawnSync } from 'node:child_process'
import { cpSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMO_SOURCE, prepareDemo } from '../bin/demo.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(repo, 'examples', 'demo-runs', 'listly')
// The run is dated on T004's Done day in the sample, so the copy's date shift moves it with the task
const RUN_DAY = '2026-09-25'

// Unshifted copy (now = the anchor day), so the fixture reads T004's checklist as committed
const [y, m, d] = readFileSync(path.join(DEMO_SOURCE, '.vibedoc-demo-anchor'), 'utf8').trim().split('-').map(Number)
const demo = prepareDemo({ now: new Date(y, m - 1, d) })
try {
  const env = { ...process.env, VIBEDOC_PROJECT: demo.root, VIBEDOC_RUNS_DIR: demo.runsDir, VIBEDOC_RUNS_KEEP: '1' }
  delete env.CI // presentation mode (cursor, chapters) is off on CI
  delete env.VIBEDOC_PRESENT
  const r = spawnSync('npx', ['playwright', 'test', '-c', 'scripts/demo-run/playwright.config.mjs'], { cwd: repo, env, stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`playwright test exited with ${r.status}`)

  const taskDir = path.join(demo.runsDir, 'listly', 'T004')
  const [runId] = readdirSync(taskDir).filter((n) => /^\d{8}T\d{6}Z$/.test(n))
  const newId = RUN_DAY.replaceAll('-', '') + runId.slice(8)
  renameSync(path.join(taskDir, runId), path.join(taskDir, newId))
  const manifestFile = path.join(taskDir, newId, 'run.json')
  const run = JSON.parse(readFileSync(manifestFile, 'utf8'))
  const redate = (iso) => RUN_DAY + iso.slice(10)
  Object.assign(run, { runId: newId, startedAt: redate(run.startedAt), endedAt: redate(run.endedAt), commit: null })
  writeFileSync(manifestFile, JSON.stringify(run, null, 2) + '\n')
  rmSync(path.join(taskDir, 'EVIDENCE.md'), { force: true }) // derived; VibeDoc formats it fresh on read

  rmSync(out, { recursive: true, force: true })
  cpSync(path.join(demo.runsDir, 'listly'), out, { recursive: true })
  console.log(`demo-run: ${run.status}, ${run.steps.length} steps → ${path.relative(repo, path.join(out, 'T004', newId))}`)
} finally {
  demo.cleanup()
}
