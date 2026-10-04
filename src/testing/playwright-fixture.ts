/**
 * VibeDoc's Playwright fixture (R059), imported by checklist specs as `vibedoc/playwright`:
 *
 *   import { test, expect } from 'vibedoc/playwright'
 *   test.use({ vibedocTask: 'T138' })            // or env VIBEDOC_TASK_ID
 *   test('T138', async ({ page, step }) => {
 *     await step('Open /board → board loads', async () => { ... })
 *   })
 *
 * Each `step` saves `NN-<slug>.png` (also when it fails), the run is recorded as `video.webm`, and
 * `run.json` is written at the end, all in `<runsRoot>/<project>/<taskId>/<runId>/` (see runs-paths.ts).
 * Runs inside the target repo's Playwright process, not the VibeDoc server, so it writes its own files.
 *
 * The package export is the compiled `dist/testing/playwright-fixture.js` (`npm run build:playwright`, run by
 * prepublishOnly): Playwright won't transpile .ts under node_modules. Hence the `.js` extension on relative imports.
 */

import { test as base, expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { newRunId, projectKey, runDir, stepFile } from '../lib/runs-paths.js'

export type RunStep = { index: number; name: string; status: 'passed' | 'failed'; screenshot: string | null; error: string | null }
/** Read by the runs API/viewer and R060: keep the shape stable. */
export type RunManifest = {
  runId: string; taskId: string; project: string; startedAt: string; endedAt: string
  status: 'passed' | 'failed'; commit: string | null; video: string | null; steps: RunStep[]
}
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

export const test = base.extend<{ vibedocTask: string | undefined; vibedocRun: Run; step: Step }>({
  vibedocTask: [undefined, { option: true }],

  vibedocRun: async ({ vibedocTask }, provide) => {
    const taskId = vibedocTask || process.env.VIBEDOC_TASK_ID || 'no-task'
    const project = projectKey(process.env.VIBEDOC_PROJECT || process.env.VIBEDOC_ROOT || process.cwd())
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
    await provide({ ...contextOptions, recordVideo: { dir: vibedocRun.dir } })
  },

  // Auto, so every test gets a video + run.json even without steps. Torn down before `page`, so it can close it.
  step: [async ({ page, vibedocRun }, provide, testInfo) => {
    const steps: RunStep[] = []
    await provide(async (name, fn) => {
      const index = steps.length + 1
      const screenshot = stepFile(index, name)
      const shoot = async () => {
        try {
          await page.screenshot({ path: path.join(vibedocRun.dir, screenshot), fullPage: true })
          return screenshot
        } catch {
          return null // page closed or crashed: the step still gets recorded
        }
      }
      try {
        const result = await base.step(name, fn)
        steps.push({ index, name, status: 'passed', screenshot: await shoot(), error: null })
        return result
      } catch (e) {
        steps.push({ index, name, status: 'failed', screenshot: await shoot(), error: plain(e instanceof Error ? e.message : String(e)) })
        throw e
      }
    })

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
      status: failed ? 'failed' : 'passed', commit: gitCommit(), video: videoFile, steps,
    }
    writeFileSync(path.join(vibedocRun.dir, 'run.json'), JSON.stringify(manifest, null, 2) + '\n')
  }, { auto: true }],
})

export { expect }
