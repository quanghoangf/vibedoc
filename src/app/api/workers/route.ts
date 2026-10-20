/**
 * POST /api/workers {target: {kind: "epic", id}, branch?, base?} (R108 T554, ADR-007)
 * Creates a worktree for the epic (default branch `vibedoc/<epic>`), installs its dependencies, saves a worker chat
 * (.vibedoc/chats/<id>.json with `worker`) and starts the task-by-task loop (src/lib/worker-runs.ts). Each task turn
 * streams through GET /api/conversations/turn?id=<id>; every step emits `worker_updated`. One worker per epic (409).
 */
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { claimNextTask, createWorktree, getRoadmapItem, getTask, installWorktreeDeps, rootFrom, saveChat, RoadmapError } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { newChatId, type Attach } from '@/lib/chats'
import { defaultBranch } from '@/lib/worktrees'
import { workerArgs } from '@/lib/worker-args'
import { releaseWorker, reserveWorker, startWorker, type WorkerChat } from '@/lib/worker-runs'

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
    const now = new Date().toISOString()
    const chat: WorkerChat = {
      id, title: `Worker ${epicId}`, messages: [], sessionId: null, busy: true, notes: [],
      attach: { kind: 'epic', id: epicId }, createdAt: now, updatedAt: now,
      worker: { ...wt, target: { kind: 'epic', id: epicId }, phase: 'starting', turns: [] },
    }
    const save = async (c: WorkerChat) => {
      await saveChat(c, root)
      emitUpdate('worker_updated', { id: c.id, phase: c.worker.phase, worker: c.worker })
      emitUpdate('chat_saved', { id: c.id })
    }
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
    const owner = `worker-${id}`
    const origin = req.nextUrl.origin
    startWorker(root, chat, {
      claim: async () => {
        const { result, task, previousStatus } = await claimNextTask(epicId, root, owner)
        if (task) emitUpdate('task_updated', { taskId: task.id, status: task.status, previousStatus, task })
        return result
      },
      taskStatus: async (taskId) => (await getTask(taskId, root)).status,
      args: (taskId) => workerArgs({
        taskId, mainRoot: root, mcpOrigin: origin, workerId: id,
        // VibeDoc's own plugin, read from the package like readPlanningSkill()
        pluginDir: path.join(process.cwd(), 'plugin'),
      }),
      save,
    })
    return NextResponse.json({ id, ...wt })
  } catch (e) {
    releaseWorker(root, id)
    const status = e instanceof RoadmapError ? e.status : 500
    return NextResponse.json({ error: (e as Error).message }, { status })
  }
}
