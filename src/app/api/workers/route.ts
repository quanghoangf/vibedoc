/**
 * POST /api/workers {target: {kind: "epic", id}, branch?, base?} (R108 T554, ADR-007)
 * Creates a worktree for the epic (default branch `vibedoc/<epic>`), installs its dependencies, saves a worker chat
 * (.vibedoc/chats/<id>.json with `worker`) and starts the task-by-task loop (src/lib/worker-runs.ts). Each task turn
 * streams through GET /api/conversations/turn?id=<id>; every step emits `worker_updated`. One worker per epic (409).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createWorktree, detectFrontend, getRoadmapItem, installWorktreeDeps, rootFrom, workerPortsInUse, RoadmapError } from '@/lib/core'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { newChatId, type Attach } from '@/lib/chats'
import { defaultBranch, WORKER_PORT_OFFSET } from '@/lib/worktrees'
import { claimWorkerPort, releaseWorker, reserveWorker, startWorker, type WorkerChat } from '@/lib/worker-runs'
import { saveWorkerChat, workerDeps } from './deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null) as { target?: Attach; branch?: unknown; base?: unknown } | null
  const epicId = body?.target?.kind === 'epic' && typeof body.target.id === 'string' ? body.target.id.trim().toUpperCase() : ''
  if (!/^R\d+$/.test(epicId)) return NextResponse.json({ error: 'target must be {kind: "epic", id: "R…"}' }, { status: 400 })
  const epic = await getRoadmapItem(epicId, root).catch(() => null)
  if (!epic) return NextResponse.json({ error: `Epic ${epicId} not found` }, { status: 404 })
  if (!epic.parent) return NextResponse.json({ error: `${epicId} is a horizon; pass an epic id` }, { status: 400 })

  const id = newChatId(Date.now())
  if (!reserveWorker(root, id, epicId)) return NextResponse.json({ error: `A worker is already running on ${epicId}` }, { status: 409 })
  try {
    const wt = await createWorktree(root, {
      branch: typeof body?.branch === 'string' && body.branch.trim() ? body.branch : defaultBranch(epicId),
      base: typeof body?.base === 'string' && body.base.trim() ? body.base : undefined,
    })
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
    startWorker(root, chat, workerDeps(root, chat, req.nextUrl.origin))
    return NextResponse.json({ id, ...wt })
  } catch (e) {
    releaseWorker(root, id)
    const status = e instanceof RoadmapError ? e.status : 500
    return NextResponse.json({ error: (e as Error).message }, { status })
  }
}
