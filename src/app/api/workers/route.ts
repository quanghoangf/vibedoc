/**
 * POST /api/workers {target: {kind: "epic" | "task", id}, mode?: "new" | "existing", workerId?, branch?, base?} (R108 T554, ADR-007)
 * The run card's Accept. The proposal is checked again first (validateRunProposal, T561: state may have changed since
 * GET /api/workers/propose), 409 with the reasons. `new` (the default) creates a worktree for the epic (default branch
 * `vibedoc/<epic>`), saves a worker chat (phase `starting`) and answers; its dependency install then runs in the
 * background (a failure ends it `failed`, the output in its reason), then the task-by-task loop starts
 * (src/lib/worker-runs.ts). The worker chat is .vibedoc/chats/<id>.json with `worker`. `existing` continues that worker's loop on its worktree: a new task
 * claim, no new worktree. T560: a task target routes to its epic's worker (it claims that task next), else a new
 * worktree on `vibedoc/T123` whose loop runs that task only and ends. Each task turn streams through
 * GET /api/workers/stream?id=<id> (T556); every step emits
 * `worker_updated`. One worker per epic, at most `workers.maxRunning` per project (409, T557).
 * GET /api/workers → {allowed, denied, maxRunning, env, maxTurnsPerTask, taskTimeoutMin, mode}: what a worker will run with
 * (Settings → Workers; T567 adds each task's budget, R113 T588 the permission mode).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createWorktree, detectFrontend, getChat, getRoadmapItem, getTask, getRunContext, installWorktreeDeps, readProjectSettings, rootFrom, workerPortsInUse, RoadmapError, type WorkerSettings } from '@/lib/core'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { newChatId, type Attach } from '@/lib/chats'
import { WORKER_PORT_OFFSET } from '@/lib/worktrees'
import { WORKER_DENIED } from '@/lib/worker-args'
import { claimWorkerPort, isCancelled, liveWorkerIds, releaseWorker, reserveWorker, startWorker, type WorkerChat } from '@/lib/worker-runs'
import { epicOf, routeRun, runRefusals } from '@/lib/run-proposal'
import { saveWorkerChat, workerDeps } from './deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { workers } = await readProjectSettings(rootFrom(req.nextUrl.searchParams.get('root')))
  return NextResponse.json({ allowed: workers.allowedTools, denied: WORKER_DENIED, maxRunning: workers.maxRunning, env: workers.env, maxTurnsPerTask: workers.maxTurnsPerTask, taskTimeoutMin: workers.taskTimeoutMin, mode: workers.mode })
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null) as { target?: Attach; mode?: unknown; workerId?: unknown; branch?: unknown; base?: unknown } | null
  // T560: a task target too; its loop runs that task only (or its epic's worker claims it next)
  const kind = body?.target?.kind === 'task' ? 'task' : 'epic'
  const targetId = typeof body?.target?.id === 'string' ? body.target.id.trim().toUpperCase() : ''
  if (!(kind === 'task' ? /^T\d+$/ : /^R\d+$/).test(targetId)) return NextResponse.json({ error: 'target must be {kind: "epic", id: "R…"} or {kind: "task", id: "T…"}' }, { status: 400 })
  if (kind === 'epic') {
    const epic = await getRoadmapItem(targetId, root).catch(() => null)
    if (!epic) return NextResponse.json({ error: `Epic ${targetId} not found` }, { status: 404 })
    if (!epic.parent) return NextResponse.json({ error: `${targetId} is a horizon; pass an epic id` }, { status: 400 })
  } else if (!(await getTask(targetId, root).catch(() => null))) return NextResponse.json({ error: `Task ${targetId} not found` }, { status: 404 })

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const target: Attach = { kind, id: targetId }
  const ctx = await getRunContext(root, liveWorkerIds(root))
  const proposal = routeRun(target, ctx, {
    mode: body?.mode === 'existing' ? 'existing' : 'new', workerId: str(body?.workerId), branch: str(body?.branch), base: str(body?.base),
  })
  const refusals = runRefusals(proposal, ctx)
  if (refusals.length) return NextResponse.json({ error: refusals.map(r => r.text).join('\n'), errors: refusals.map(r => r.text), refusals }, { status: 409 })

  const { workers } = await readProjectSettings(root)
  const existing = proposal.mode === 'existing' ? await getChat(proposal.workerId ?? '', root).catch(() => null) as WorkerChat | null : null
  if (proposal.mode === 'existing' && !existing?.worker) return NextResponse.json({ error: `No worker ${proposal.workerId}` }, { status: 404 })
  const id = existing?.id ?? newChatId(Date.now())
  // one worker per epic: a task in an epic holds its epic, a loose task itself
  const holds = existing?.worker.target.id ?? epicOf(target, ctx) ?? targetId
  const taken = reserveWorker(root, id, holds, workers.maxRunning, existing?.worker.port)
  if (taken === 'epic') return NextResponse.json({ error: `A worker is already running on ${holds}` }, { status: 409 })
  if (taken === 'limit') return NextResponse.json({ error: `The limit of ${workers.maxRunning} running workers is reached (Settings → Workers). Stop one, or wait.` }, { status: 409 })
  if (existing) {
    if (kind === 'task' && existing.worker.target.kind === 'epic') existing.worker.nextTask = targetId
    // R113 T588: the mode in Settings now (and what this CLI supports) for its next turns
    if (proposal.permission) existing.worker.permissionMode = proposal.permission.mode
    return continueWorker(root, existing, req.nextUrl.origin, workers)
  }
  try {
    const wt = await createWorktree(root, { branch: proposal.branch, base: proposal.base })
    // T559: its own dev server port above the project's frontend port, so a UI spec tests this branch
    const [app, saved] = await Promise.all([detectFrontend(root), workerPortsInUse(root)])
    const appPort = app && URL.canParse(app.url) ? Number(new URL(app.url).port) : 0
    const port = appPort ? claimWorkerPort(root, id, appPort + WORKER_PORT_OFFSET, saved) : undefined
    const now = new Date().toISOString()
    const chat: WorkerChat = {
      id, title: `Worker ${targetId}`, messages: [], sessionId: null, busy: true, notes: [],
      attach: target, createdAt: now, updatedAt: now,
      worker: { ...wt, target, phase: 'starting', turns: [], ...(port && { port }), ...(proposal.permission && { permissionMode: proposal.permission.mode }) },
    }
    await saveWorkerChat(root)(chat)
    // the install runs after the reply: the run card closes at once and the chat shows "Setting up the worktree"
    void setUpAndStart(root, chat, req.nextUrl.origin, workers)
    return NextResponse.json({ id, ...wt })
  } catch (e) {
    releaseWorker(root, id)
    const status = e instanceof RoadmapError ? e.status : 500
    return NextResponse.json({ error: (e as Error).message }, { status })
  }
}

/** T561: `existing` + Accept: the worker's loop claims its epic's next task in the same worktree. */
async function continueWorker(root: string, chat: WorkerChat, origin: string, workers: WorkerSettings) {
  const save = saveWorkerChat(root)
  try {
    chat.busy = true
    chat.updatedAt = new Date().toISOString()
    // a worker whose setup failed gets its install again (after the reply); the others have their dependencies
    const install = chat.worker.phase === 'failed'
    chat.worker = { ...chat.worker, phase: install ? 'starting' : 'running', reason: undefined }
    await save(chat)
    if (install) void setUpAndStart(root, chat, origin, workers)
    else startWorker(root, chat, workerDeps(root, chat, origin, workers))
    const { dir, branch, base } = chat.worker
    return NextResponse.json({ id: chat.id, dir, branch, base, mode: 'existing' })
  } catch (e) {
    releaseWorker(root, chat.id)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** A `starting` worker: its worktree's dependency install, then its loop; a failed install ends it `failed` with the output. */
async function setUpAndStart(root: string, chat: WorkerChat, origin: string, workers: WorkerSettings) {
  const save = saveWorkerChat(root)
  try {
    const install = await installWorktreeDeps(chat.worker.dir)
    if (!install.ok) throw new Error(`Dependency install failed:\n${install.output}`)
    if (isCancelled(root, chat.id)) {
      chat.busy = false
      chat.worker = { ...chat.worker, phase: 'stopped' }
      releaseWorker(root, chat.id)
      return void await save(chat)
    }
    chat.worker.phase = 'running'
    startWorker(root, chat, workerDeps(root, chat, origin, workers))
  } catch (e) {
    chat.busy = false
    chat.worker = { ...chat.worker, phase: 'failed', reason: (e as Error).message }
    releaseWorker(root, chat.id)
    await save(chat).catch(() => {})
  }
}
