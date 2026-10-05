/**
 * Regression suite (R064): every done task's spec in one Playwright run.
 * POST /api/suite/run → 202 + SuiteState: reuse or start the app, then `npx playwright test <every spec>` with
 *                       VIBEDOC_TASK_MAP; SSE `suite_run` per step; at the end each run task's file gets its result.
 * GET  /api/suite/run → the project's current or last suite (null when none yet).
 * Shares the one-run-per-project lock with POST /api/tasks/run (409 either way); cancel = /api/suite/run/cancel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { detectFrontend, detectPlaywright, readProjectSettings, ensureFixtureKit, frontendAppDir, listTasks, readFrontendStartTimeoutSec, recordRunResult, removeUnfinishedRuns, rootFrom, testReporterPath } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { ensureFrontend, ownsServer } from '@/lib/frontend-server'
import { busyWith, startSuite, suiteState } from '@/lib/test-runner'
import { specInApp } from '@/lib/test-run-events'
import { collectSuite } from '@/lib/suite'
import { isDemo, demoForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return NextResponse.json({ suite: suiteState(rootFrom(req.nextUrl.searchParams.get('root'))) })
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const busy = busyWith(root)
  if (busy) return NextResponse.json({ error: busy }, { status: 409 })

  const app = await detectFrontend(root)
  if (!app) return NextResponse.json({ error: 'No frontend app detected' }, { status: 404 })
  const cwd = frontendAppDir(root, app)
  if (!cwd) return NextResponse.json({ error: `App dir ${app.dir} is outside the project` }, { status: 400 })
  if (!URL.canParse(app.url)) return NextResponse.json({ error: 'Set the app URL first' }, { status: 400 })
  const pw = await detectPlaywright(root, app)
  if (!pw.installed) return NextResponse.json({ error: 'Playwright isn’t installed in the app: Install it first' }, { status: 409 })
  if (pw.browsersInstalled === false) return NextResponse.json({ error: 'Chromium isn’t installed for Playwright: Install it first' }, { status: 409 })
  const reporter = await testReporterPath()
  if (!reporter) return NextResponse.json({ error: 'VibeDoc’s test reporter is missing from this install' }, { status: 500 })

  const { tasks } = await listTasks(root)
  const { entries, skipped } = collectSuite(tasks, (spec) => specInApp(spec, app.dir))
  if (!entries.length) return NextResponse.json({ error: 'No done task has a spec to run' }, { status: 409 })
  await ensureFixtureKit(root, app)

  try {
    const suite = startSuite({
      root, entries, skipped,
      onChange: (s) => {
        emitUpdate('suite_run', { suite: s })
        if (s.state === 'cancelled') void removeUnfinishedRuns(root, s.startedAt).catch(() => {})
        if (s.state !== 'passed' && s.state !== 'failed') return
        // Each task the suite reached gets its result like a single Run (Auto: header, 🤖 ticks); the rest stay
        void (async () => {
          for (const t of s.tasks) {
            if (t.status !== 'passed' && t.status !== 'failed') continue
            const r = await recordRunResult(t.taskId, t.status, null, root, s.startedAt).catch(() => null)
            if (r) emitUpdate('task_updated', { taskId: t.taskId, task: r.task })
          }
          emitUpdate('suite_run', { suite: s })
        })()
      },
      prepare: async () => {
        const ownedBefore = ownsServer(root)
        const server = await ensureFrontend({
          root, cwd, url: app.url, startCommand: app.startCommand, timeoutSec: await readFrontendStartTimeoutSec(root),
          onChange: () => emitUpdate('frontend_server_updated', {}),
        })
        const startedServer = server.startedByUs && !ownedBefore
        if (startedServer) emitUpdate('frontend_server_updated', { state: 'running' })
        return {
          cwd, reporter, env: { VIBEDOC_PROJECT: root }, retries: (await readProjectSettings(root)).testRetries,
          done: () => {
            if (!startedServer) return
            server.stop()
            emitUpdate('frontend_server_updated', { state: 'stopped' })
          },
        }
      },
    })
    emitUpdate('suite_run', { suite })
    return NextResponse.json({ suite }, { status: 202 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
