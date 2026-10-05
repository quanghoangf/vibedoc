/**
 * Run a task's tests from VibeDoc (R061).
 * POST /api/tasks/run {id} → 202 + RunState: reuse or start the app, then `npx playwright test <spec>` in the app
 *                            dir with VibeDoc's reporter; every step and the end go out as SSE `test_run`.
 * GET  /api/tasks/run      → the project's current or last RunState (null when none yet).
 * One run per project (409 while one is going); cancel = POST /api/tasks/run/cancel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { detectFrontend, detectPlaywright, readProjectSettings, ensureFixtureKit, frontendAppDir, getTask, readFrontendStartTimeoutSec, recordRunResult, removeUnfinishedRuns, sendBackFailedRun, noteAutoRunPassed, rootFrom, testReporterPath } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { ensureFrontend, ownsServer } from '@/lib/frontend-server'
import { busyWith, runState, startRun } from '@/lib/test-runner'
import { specInApp } from '@/lib/test-run-events'
import { isRunTaskId } from '@/lib/runs-paths'
import { isDemo, demoForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return NextResponse.json({ run: runState(rootFrom(req.nextUrl.searchParams.get('root'))) })
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const id = String((await req.json().catch(() => null))?.id ?? '')
  if (!isRunTaskId(id)) return NextResponse.json({ error: 'Bad task id' }, { status: 400 })

  let spec: string | null
  try {
    spec = (await getTask(id, root)).manualTests?.spec ?? null
  } catch {
    return NextResponse.json({ error: `Task not found: ${id}` }, { status: 404 })
  }
  if (!spec) return NextResponse.json({ error: `${id} has no spec to run` }, { status: 409 })
  const busy = busyWith(root) // a single Run and the suite share the lock (R064)
  if (busy) return NextResponse.json({ error: busy }, { status: 409 })

  const app = await detectFrontend(root)
  if (!app) return NextResponse.json({ error: 'No frontend app detected' }, { status: 404 })
  const cwd = frontendAppDir(root, app)
  if (!cwd) return NextResponse.json({ error: `App dir ${app.dir} is outside the project` }, { status: 400 })
  if (!URL.canParse(app.url)) return NextResponse.json({ error: 'Set the app URL first' }, { status: 400 })
  // The spec path is relative to the repo root; Playwright runs from the app dir
  const specRel = specInApp(spec, app.dir)
  if (!specRel) {
    return NextResponse.json({ error: `Spec ${spec} is outside the app dir ${app.dir}` }, { status: 400 })
  }
  const pw = await detectPlaywright(root, app)
  if (!pw.installed) return NextResponse.json({ error: 'Playwright isn’t installed in the app: Install it first' }, { status: 409 })
  if (pw.browsersInstalled === false) return NextResponse.json({ error: 'Chromium isn’t installed for Playwright: Install it first' }, { status: 409 })
  const reporter = await testReporterPath()
  if (!reporter) return NextResponse.json({ error: 'VibeDoc’s test reporter is missing from this install' }, { status: 500 })

  // Specs import the kit from the repo: make sure it's there and current before Playwright loads them
  await ensureFixtureKit(root, app)

  try {
    const state = startRun({
      root, taskId: id, spec,
      onChange: (s) => {
        emitUpdate('test_run', { taskId: id, state: s })
        if (s.state === 'cancelled') void removeUnfinishedRuns(root, s.startedAt).catch(() => {})
        // A verdict goes into the task file like an agent's run (Auto: header + 🤖 ticks); cancelled / error write nothing
        if (s.state === 'passed' || s.state === 'failed') {
          const result = s.state
          void (async () => {
            const r = await recordRunResult(id, result, s.steps, root, s.startedAt)
            if (r) emitUpdate('task_updated', { taskId: id, task: r.task })
            // R065: a failed run goes straight back to the agent with its failed steps (tests.autoSendBack)
            const back = result === 'failed' ? await sendBackFailedRun(id, root, s.startedAt) : null
            if (back) emitUpdate('task_updated', { taskId: id, status: back.task.status, previousStatus: back.previousStatus, task: back.task, autoSendBack: true })
            // …and a pass after automatic send-backs ends that streak (the attempt cap counts from here again)
            const reset = result === 'passed' ? await noteAutoRunPassed(id, root) : null
            if (reset) emitUpdate('task_updated', { taskId: id, task: reset })
          })()
            .catch((e) => console.warn(`vibedoc: could not record the ${id} run: ${(e as Error).message}`))
        }
      },
      prepare: async () => {
        // An app the user started stays up; only one started for this run is stopped after it
        const ownedBefore = ownsServer(root)
        const server = await ensureFrontend({
          root, cwd, url: app.url, startCommand: app.startCommand, timeoutSec: await readFrontendStartTimeoutSec(root),
          onChange: () => emitUpdate('frontend_server_updated', {}),
        })
        const startedServer = server.startedByUs && !ownedBefore
        if (startedServer) emitUpdate('frontend_server_updated', { state: 'running' })
        return {
          cwd, specRel, reporter, retries: (await readProjectSettings(root)).testRetries,
          env: { VIBEDOC_PROJECT: root, VIBEDOC_TASK_ID: id },
          // R063: after a pass, run again on a blank page; the fixture writes honesty.json into the new run
          blankEnv: { VIBEDOC_BLANK: '1' },
          done: () => {
            if (!startedServer) return
            server.stop()
            emitUpdate('frontend_server_updated', { state: 'stopped' })
          },
        }
      },
    })
    emitUpdate('test_run', { taskId: id, state })
    return NextResponse.json({ run: state }, { status: 202 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
