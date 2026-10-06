/**
 * VibeDoc's Playwright fixture (R059). Specs import it from the test kit VibeDoc copies into the app (R061:
 * `<testDir>/vibedoc/kit/`, ensureFixtureKit in core; keep its relative imports to the kit's files), or as
 * `vibedoc/playwright` when the app depends on the vibedoc package:
 *
 *   import { test, expect } from './kit/testing/playwright-fixture'
 *   test.use({ vibedocTask: 'T138' })            // or env VIBEDOC_TASK_ID
 *   test('T138', async ({ page, step }) => {
 *     await step('Open /board → board loads', async () => { ... })
 *   })
 *
 * Each `step` saves `NN-<slug>.png` (also when it fails), the run is recorded as `video.webm`, and
 * `run.json` is written at the end, all in `<runsRoot>/<project>/<taskId>/<runId>/` (see runs-paths.ts).
 * `EVIDENCE.md` (R060, src/lib/evidence.ts) is rewritten next to the runs after each one.
 * Then only the newest N runs of that task are kept: `$VIBEDOC_RUNS_KEEP`, else `runs.keep` in the project's
 * `.vibedoc/settings.json`, else 5 (runs-retention.ts).
 * Runs inside the target repo's Playwright process, not the VibeDoc server, so it writes its own files.
 *
 * The package export is the compiled `dist/testing/playwright-fixture.js` (`npm run build:playwright`, run by
 * prepublishOnly): Playwright won't transpile .ts under node_modules. Hence the `.js` extension on relative imports.
 */

import { test as base, expect as baseExpect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { newRunId, parseRunHonesty, parseRunManifest, projectKey, runDir, stepFile } from '../lib/runs-paths.js'
import { parseKeep, planPrune } from '../lib/runs-retention.js'
import { parseManualTests } from '../lib/manual-tests.js'
import { formatEvidence } from '../lib/evidence.js'
import { isPageSubject, stepVerdict } from '../lib/honesty.js'
import { parseTaskMap, taskForFile } from '../lib/task-map.js'
import { presentationMode } from '../lib/presentation.js'

import type { RunManifest, RunStep, RunTest } from '../lib/runs-paths.js'
export type { RunManifest, RunStep }
type Run = { dir: string; runId: string; taskId: string; project: string; startedAt: string }
type Step = <T>(name: string, fn: () => Promise<T>) => Promise<T>

/** Playwright colours its messages; run.json gets the plain text. */
const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')

function gitCommit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
  } catch {
    return null // not a git repo
  }
}

const RUN_ID = /^\d{8}T\d{6}Z$/
const projectRoot = () => process.env.VIBEDOC_PROJECT || process.env.VIBEDOC_ROOT || process.cwd()

/** `$VIBEDOC_RUNS_KEEP` wins; else the project's `runs.keep` setting (same key core's readProjectSettings reads). */
function runsKeep(): number {
  if (process.env.VIBEDOC_RUNS_KEEP) return parseKeep(process.env.VIBEDOC_RUNS_KEEP)
  try {
    return parseKeep(JSON.parse(readFileSync(path.join(projectRoot(), '.vibedoc', 'settings.json'), 'utf8'))?.runs?.keep)
  } catch {
    return parseKeep(undefined) // no settings file: the default
  }
}

/**
 * Delete all but the newest N finished runs of this task. Never the current run, never fails the test.
 * Only dirs with a run.json count: another worker's run that is still being written has none yet.
 */
function pruneRuns(run: Run): void {
  const taskDir = path.dirname(run.dir)
  try {
    const ids = readdirSync(taskDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && RUN_ID.test(d.name) && existsSync(path.join(taskDir, d.name, 'run.json')))
      .map(d => d.name)
    for (const id of planPrune(ids, runsKeep(), run.runId)) {
      try {
        rmSync(path.join(taskDir, id), { recursive: true, force: true })
      } catch (e) {
        console.warn(`vibedoc: could not delete old run ${id}: ${e instanceof Error ? e.message : e}`)
      }
    }
  } catch (e) {
    console.warn(`vibedoc: could not prune runs in ${taskDir}: ${e instanceof Error ? e.message : e}`)
  }
}

// R063: the step running now counts its expects; how many of them looked at the page (vs literals) decides honesty
let tally: { total: number; onPage: number } | null = null
const count = (subject: unknown) => {
  if (!tally) return
  tally.total++
  if (isPageSubject(subject)) tally.onPage++
}

/** Playwright's expect, counting each `expect(subject)` / `.soft` / `.poll` (and those of `expect.configure(...)`). */
function counted<E extends typeof baseExpect>(e: E): E {
  return new Proxy(e, {
    apply(target, thisArg, args) {
      count(args[0])
      return Reflect.apply(target, thisArg, args)
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      if (prop === 'soft' || prop === 'poll') return (...args: unknown[]) => { count(args[0]); return value.apply(target, args) }
      if (prop === 'configure') return (...args: unknown[]) => counted(value.apply(target, args))
      return value
    },
  })
}

export const expect = counted(baseExpect)

/**
 * R063 blank-app check: with VIBEDOC_BLANK=1 every document request gets an empty page and nothing is recorded;
 * the steps that still pass go into `honesty.json` of the task's newest finished run (they prove nothing about
 * the app). VibeDoc runs this pass after each passing Run.
 */
const BLANK = process.env.VIBEDOC_BLANK === '1'
const BLANK_PAGE = '<!doctype html><title>blank</title>'
// R079 presentation recording: Playwright's own action annotations (1.59+). Each action waits out ACTION_MS, so a
// person can follow the cursor; colours read on light and dark apps. The decorations are gone by the time an
// action returns, so step screenshots (taken after the step) stay clean without hiding them first.
const ACTION_MS = 600
const ACTION_STYLE = {
  point: 'width:22px;height:22px;border-radius:50%;background:rgba(124,92,255,.35);box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(20,20,30,.85)',
  highlight: 'outline:2px solid #7c5cff;outline-offset:2px;background:rgba(124,92,255,.12);border-radius:4px',
  title: 'font:600 14px system-ui,sans-serif;padding:6px 10px;border-radius:6px;background:rgba(20,20,30,.85);color:#fff',
}

function readHonesty(dir: string) {
  try {
    return parseRunHonesty(readFileSync(path.join(dir, 'honesty.json'), 'utf8'))
  } catch {
    return null // not checked
  }
}

function writeHonesty(run: Run, steps: RunStep[]): void {
  const taskDir = path.dirname(runDir(run.project, run.taskId, run.runId))
  try {
    const newest = readdirSync(taskDir).filter(id => RUN_ID.test(id) && existsSync(path.join(taskDir, id, 'run.json'))).sort().pop()
    if (!newest) return
    const blankPassed = steps.filter(s => s.status === 'passed').map(s => s.name)
    writeFileSync(path.join(taskDir, newest, 'honesty.json'), JSON.stringify({ checkedAt: new Date().toISOString(), blankPassed }, null, 2) + '\n')
    writeEvidence({ ...run, dir: path.join(taskDir, newest), runId: newest })
  } catch (e) {
    console.warn(`vibedoc: could not write honesty.json in ${taskDir}: ${e instanceof Error ? e.message : e}`)
  }
}

/**
 * R065: Playwright retries a failing test in a fresh worker, so attempts meet on disk: attempt N finds attempt N-1's
 * run (same testId, retry N-1), keeps the first failure (its step, error and screenshot, copied in as
 * `first-failure-<file>`) and removes that run, so one test leaves one run whose outcome spans its attempts.
 */
function foldRetries(run: Run, testId: string, retry: number, title: string, passed: boolean): Pick<RunManifest, 'testId' | 'retry' | 'tests' | 'flaky'> {
  const outcome: RunTest['outcome'] = passed ? (retry > 0 ? 'flaky' : 'passed') : 'failed'
  const test: RunTest = { title, outcome, attempts: retry + 1 }
  if (retry > 0) {
    const taskDir = path.dirname(run.dir)
    try {
      for (const id of readdirSync(taskDir).filter(d => RUN_ID.test(d) && d !== run.runId)) {
        const prev = (() => { try { return parseRunManifest(readFileSync(path.join(taskDir, id, 'run.json'), 'utf8')) } catch { return null } })()
        if (!prev || prev.testId !== testId || prev.retry !== retry - 1) continue
        let first = prev.tests?.[0]?.firstFailure
        if (!first) {
          const step = prev.steps.find(s => s.status === 'failed') ?? null
          first = { step: step?.name ?? null, error: step?.error ?? null, screenshot: step?.screenshot ?? null }
        }
        if (first.screenshot) {
          const copied = first.screenshot.startsWith('first-failure-') ? first.screenshot : `first-failure-${first.screenshot}`
          try {
            copyFileSync(path.join(taskDir, id, first.screenshot), path.join(run.dir, copied))
            first = { ...first, screenshot: copied }
          } catch {
            first = { ...first, screenshot: null }
          }
        }
        test.firstFailure = first
        rmSync(path.join(taskDir, id), { recursive: true, force: true })
      }
    } catch (e) {
      console.warn(`vibedoc: could not fold retry ${retry} of ${title}: ${e instanceof Error ? e.message : e}`)
    }
  }
  return { testId, retry, tests: [test], flaky: outcome === 'flaky' ? 1 : 0 }
}

/**
 * Rewrite `<taskDir>/EVIDENCE.md` (R060) from the kept runs and the task file's checklist. Only the fixture writes
 * it; VibeDoc formats the same doc on read. Never fails the test.
 */
function writeEvidence(run: Run): void {
  const taskDir = path.dirname(run.dir)
  try {
    const tasksDir = path.join(projectRoot(), 'plans', 'tasks')
    const file = existsSync(tasksDir) ? readdirSync(tasksDir).find(f => f.startsWith(`${run.taskId}-`) && f.endsWith('.md')) : undefined
    const raw = file ? readFileSync(path.join(tasksDir, file), 'utf8') : ''
    const title = raw.match(/^#\s+T\d+:\s*(.+)$/m)?.[1].trim() ?? run.taskId
    const tests = raw ? parseManualTests(raw) : null
    const runs = readdirSync(taskDir).filter(id => RUN_ID.test(id)).sort().reverse()
      .map(id => { try { return parseRunManifest(readFileSync(path.join(taskDir, id, 'run.json'), 'utf8')) } catch { return null } })
      .filter((r): r is RunManifest => r !== null)
      .map(r => { const h = readHonesty(path.join(taskDir, r.runId)); return h ? { ...r, honesty: h } : r })
    writeFileSync(path.join(taskDir, 'EVIDENCE.md'), formatEvidence({ taskId: run.taskId, title, items: tests?.items ?? [], spec: tests?.spec ?? null, runs, verdict: (s, r) => stepVerdict(s, !!r.honesty?.blankPassed.includes(s.name)) }))
  } catch (e) {
    console.warn(`vibedoc: could not write EVIDENCE.md in ${taskDir}: ${e instanceof Error ? e.message : e}`)
  }
}

/** The part of Playwright 1.59's `page.screencast` the kit uses; older apps' types don't have it. */
type Screencast = {
  showActions: (o: { cursor?: 'pointer' | 'none'; duration?: number; position?: string; style?: { point?: string; highlight?: string; title?: string } }) => Promise<unknown>
}

export const test = base.extend<{ vibedocTask: string | undefined; vibedocRun: Run; step: Step }>({
  vibedocTask: [undefined, { option: true }],

  vibedocRun: async ({ vibedocTask }, provide, testInfo) => {
    // The spec's own vibedocTask, else its entry in VIBEDOC_TASK_MAP (a suite: many tasks, one process), else the env
    const fallback = process.env.VIBEDOC_TASK_ID || 'no-task'
    const taskId = vibedocTask || taskForFile(parseTaskMap(process.env.VIBEDOC_TASK_MAP), path.relative(process.cwd(), testInfo.file), fallback)
    const project = projectKey(projectRoot())
    if (BLANK) {
      const dir = mkdtempSync(path.join(os.tmpdir(), 'vibedoc-blank-'))
      await provide({ dir, runId: newRunId(), taskId, project, startedAt: new Date().toISOString() })
      rmSync(dir, { recursive: true, force: true })
      return
    }
    let at = new Date()
    mkdirSync(path.dirname(runDir(project, taskId, newRunId(at))), { recursive: true })
    // Two runs of one task in the same second (or parallel workers): the exclusive mkdir picks the next free second
    for (;;) {
      try {
        mkdirSync(runDir(project, taskId, newRunId(at)))
        break
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
        at = new Date(at.getTime() + 1000)
      }
    }
    const runId = newRunId(at)
    const dir = runDir(project, taskId, runId)
    await provide({ dir, runId, taskId, project, startedAt: new Date().toISOString() })
  },

  contextOptions: async ({ contextOptions, vibedocRun }, provide) => {
    await provide(BLANK ? contextOptions : { ...contextOptions, recordVideo: { dir: vibedocRun.dir } })
  },

  // Auto, so every test gets a video + run.json even without steps. Torn down before `page`, so it can close it.
  step: [async ({ page, vibedocRun }, provide, testInfo) => {
    const steps: RunStep[] = []
    if (BLANK) {
      await page.route('**/*', r => (r.request().resourceType() === 'document'
        ? r.fulfill({ status: 200, contentType: 'text/html', body: BLANK_PAGE })
        : r.continue()))
    }
    // R079: presentation recording, decided once; `page.screencast` exists from Playwright 1.59 (the app's own copy)
    const screencast = (page as unknown as { screencast?: Screencast }).screencast
    const presentation = presentationMode(process.env, typeof screencast?.showActions === 'function')
    if (presentation.on && screencast) {
      await screencast.showActions({ cursor: 'pointer', duration: ACTION_MS, position: 'top-right', style: ACTION_STYLE })
    }
    // The page (and its video) exists by now, so offsets from here line up with the video's clock
    const t0 = Date.now()
    await provide(async (name, fn) => {
      const index = steps.length + 1
      const startMs = Date.now() - t0
      const screenshot = stepFile(index, name)
      const shoot = async () => {
        if (BLANK) return null
        try {
          await page.screenshot({ path: path.join(vibedocRun.dir, screenshot), fullPage: true })
          return screenshot
        } catch {
          return null // page closed or crashed: the step still gets recorded
        }
      }
      const assertions = { total: 0, onPage: 0 }
      tally = assertions
      try {
        const result = await base.step(name, fn)
        tally = null
        steps.push({ index, name, status: 'passed', screenshot: await shoot(), error: null, startMs, endMs: Date.now() - t0, assertions })
        return result
      } catch (e) {
        tally = null
        steps.push({ index, name, status: 'failed', screenshot: await shoot(), error: plain(e instanceof Error ? e.message : String(e)), startMs, endMs: Date.now() - t0, assertions })
        throw e
      }
    })

    if (BLANK) return writeHonesty(vibedocRun, steps)
    const video = page.video()
    await page.close()
    let videoFile: string | null = null
    if (video) {
      await video.saveAs(path.join(vibedocRun.dir, 'video.webm'))
      await video.delete()
      videoFile = 'video.webm'
    }
    const failed = testInfo.status !== 'passed' || steps.some(s => s.status === 'failed')
    const manifest: RunManifest = {
      runId: vibedocRun.runId, taskId: vibedocRun.taskId, project: vibedocRun.project,
      startedAt: vibedocRun.startedAt, endedAt: new Date().toISOString(),
      status: failed ? 'failed' : 'passed', commit: gitCommit(), video: videoFile, steps, presentation,
      ...foldRetries(vibedocRun, testInfo.testId, testInfo.retry, testInfo.title, !failed),
    }
    writeFileSync(path.join(vibedocRun.dir, 'run.json'), JSON.stringify(manifest, null, 2) + '\n')
    pruneRuns(vibedocRun)
    writeEvidence(vibedocRun)
  }, { auto: true }],
})

