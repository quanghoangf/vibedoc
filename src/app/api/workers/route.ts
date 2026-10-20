/**
 * POST /api/workers {target: {kind: "epic", id}, mode?: "new" | "existing", workerId?, branch?, base?} (R108 T554, ADR-007)
 * The run card's Accept. The proposal is checked again first (validateRunProposal, T561: state may have changed since
 * GET /api/workers/propose), 409 with the reasons. `new` (the default) creates a worktree for the epic (default branch
 * `vibedoc/<epic>`), installs its dependencies, saves a worker chat (.vibedoc/chats/<id>.json with `worker`) and starts
 * the task-by-task loop (src/lib/worker-runs.ts). `existing` continues that worker's loop on its worktree: a new task
 * claim, no new worktree. Each task turn streams through GET /api/conversations/turn?id=<id>; every step emits
 * `worker_updated`. One worker per epic, at most `workers.maxRunning` per project (409, T557).
 * GET /api/workers → {allowed, denied, maxRunning, env}: what a worker will run with (Settings → Workers).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createWorktree, detectFrontend, getChat, getRoadmapItem, getRunContext, installWorktreeDeps, readProjectSettings, rootFrom, workerPortsInUse, RoadmapError, type WorkerSettings } from '@/lib/core'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { newChatId, type Attach } from '@/lib/chats'
import { WORKER_PORT_OFFSET } from '@/lib/worktrees'
import { WORKER_DENIED } from '@/lib/worker-args'
import { claimWorkerPort, liveWorkerIds, releaseWorker, reserveWorker, startWorker, type WorkerChat } from '@/lib/worker-runs'
import { routeRun, validateRunProposal } from '@/lib/run-proposal'
import { saveWorkerChat, workerDeps } from './deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { workers } = await readProjectSettings(rootFrom(req.nextUrl.searchParams.get('root')))
  return NextResponse.json({ allowed: workers.allowedTools, denied: WORKER_DENIED, maxRunning: workers.maxRunning, env: workers.env })
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null) as { target?: Attach; mode?: unknown; workerId?: unknown; branch?: unknown; base?: unknown } | null
  const epicId = body?.target?.kind === 'epic' && typeof body.target.id === 'string' ? body.target.id.trim().toUpperCase() : ''
  if (!/^R\d+$/.test(epicId)) return NextResponse.json({ error: 'target must be {kind: "epic", id: "R…"}' }, { status: 400 })
  const epic = await getRoadmapItem(epicId, root).catch(() => null)
  if (!epic) return NextResponse.json({ error: `Epic ${epicId} not found` }, { status: 404 })
  if (!epic.parent) return NextResponse.json({ error: `${epicId} is a horizon; pass an epic id` }, { status: 400 })

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const ctx = await getRunContext(root, liveWorkerIds(root))
  const proposal = routeRun({ kind: 'epic', id: epicId }, ctx, {
    mode: body?.mode === 'existing' ? 'existing' : 'new', workerId: str(body?.workerId), branch: str(body?.branch), base: str(body?.base),
  })
  const errors = validateRunProposal(proposal, ctx)
  if (errors.length) return NextResponse.json({ error: errors.join('\n'), errors }, { status: 409 })

  const { workers } = await readProjectSettings(root)
  const existing = proposal.mode === 'existing' ? await getChat(proposal.workerId ?? '', root).catch(() => null) as WorkerChat | null : null
  if (proposal.mode === 'existing' && !existing?.worker) return NextResponse.json({ error: `No worker ${proposal.workerId}` }, { status: 404 })
  const id = existing?.id ?? newChatId(Date.now())
  const taken = reserveWorker(root, id, epicId, workers.maxRunning, existing?.worker.port)
  if (taken === 'epic') return NextResponse.json({ error: `A worker is already running on ${epicId}` }, { status: 409 })
  if (taken === 'limit') return NextResponse.json({ error: `The limit of ${workers.maxRunning} running workers is reached (Settings → Workers). Stop one, or wait.` }, { status: 409 })
  if (existing) return continueWorker(root, existing, req.nextUrl.origin, workers)
  try {
    const wt = await createWorktree(root, { branch: proposal.branch, base: proposal.base })
    // T559: its own dev server port above the project's frontend port, so a UI spec tests this branch
    const [app, saved] = await Promise.all([detectFrontend(root), workerPortsInUse(root)])
    const appPort = app && URL.canParse(app.url) ? Number(new URL(app.url).port) : 0
    const port = appPort ? claimWorkerPort(root, id, appPort + WORKER_PORT_OFFSET, saved) : undefined
    const now = new Date().toISOString()
    const chat: WorkerChat = {
      id, title: `Worker ${epicId}`, messages: [], sessionId: null, busy: true, notes: [],
      attach: { kind: 'epic', id: epicId }, createdAt: now, updatedAt: now,
      worker: { ...wt, target: { kind: 'epic', id: epicId }, phase: 'starting', turns: [], ...(port && { port }) },
    }
    const save = saveWorkerChat(root)
    await save(chat)
    const install = await installWorktreeDeps(wt.dir)
    if (!install.ok) {
      chat.busy = false
      chat.worker = { ...chat.worker, phase: 'failed', reason: `Dependency install failed:\n${install.output}` }
      await save(chat)
      releaseWorker(root, id)
      return NextResponse.json({ error: chat.worker.reason, id, ...wt }, { status: 500 })
    }
    chat.worker.phase = 'running'
    startWorker(root, chat, workerDeps(root, chat, req.nextUrl.origin, workers))
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
    // a worker whose setup failed gets its install again; the others have their dependencies
    if (chat.worker.phase === 'failed') {
      const install = await installWorktreeDeps(chat.worker.dir)
      if (!install.ok) {
        chat.worker = { ...chat.worker, reason: `Dependency install failed:\n${install.output}` }
        await save(chat)
        releaseWorker(root, chat.id)
        return NextResponse.json({ error: chat.worker.reason, id: chat.id }, { status: 500 })
      }
    }
    chat.busy = true
    chat.updatedAt = new Date().toISOString()
    chat.worker = { ...chat.worker, phase: 'running', reason: undefined }
    await save(chat)
    startWorker(root, chat, workerDeps(root, chat, origin, workers))
    const { dir, branch, base } = chat.worker
    return NextResponse.json({ id: chat.id, dir, branch, base, mode: 'existing' })
  } catch (e) {
    releaseWorker(root, chat.id)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
