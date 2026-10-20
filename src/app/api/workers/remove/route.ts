/**
 * POST /api/workers/remove {id, discard?, deleteBranch?} (R108 T563)
 * Removes a finished worker's worktree (and its dev server, so its port is free). Uncommitted changes → 409 with
 * `dirty: true` unless `discard`. `deleteBranch` also runs `git branch -D` (the user confirmed it in the dialog). The
 * chat stays as history with `worker.removedAt`. 409 while the worker runs or waits on the user (an answer would resume
 * it in a folder that is gone).
 */
import { NextRequest, NextResponse } from 'next/server'
import { deleteBranch, getChat, removeWorktree, rootFrom, RoadmapError } from '@/lib/core'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { releaseWorker, reserveWorker, type WorkerChat } from '@/lib/worker-runs'
import type { WorkerPhase } from '@/lib/chats'
import { saveWorkerChat } from '../deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REMOVABLE: WorkerPhase[] = ['ended', 'stopped', 'failed']

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => ({})) as { id?: unknown; discard?: unknown; deleteBranch?: unknown }
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const chat = await getChat(body.id, root).catch(() => null) as WorkerChat | null
  if (!chat?.worker) return NextResponse.json({ error: 'No worker with this id' }, { status: 404 })
  if (chat.worker.removedAt) return NextResponse.json({ error: 'This worker\'s worktree is already removed' }, { status: 409 })
  if (!REMOVABLE.includes(chat.worker.phase)) return NextResponse.json({ error: 'Stop the worker before you remove its worktree' }, { status: 409 })
  // hold it, so no run starts on this worktree while it goes
  if (reserveWorker(root, chat.id, chat.worker.target.id)) return NextResponse.json({ error: 'This worker is running' }, { status: 409 })
  try {
    await removeWorktree(root, chat.worker.dir, { force: body.discard === true })
    let branchError: string | undefined
    if (body.deleteBranch === true) {
      await deleteBranch(root, chat.worker.branch).catch((e: Error) => { branchError = e.message })
    }
    const now = new Date().toISOString()
    chat.worker = { ...chat.worker, removedAt: now }
    chat.updatedAt = now
    await saveWorkerChat(root)(chat)
    return NextResponse.json({ ok: true, ...(branchError && { branchError }) })
  } catch (e) {
    const status = e instanceof RoadmapError ? e.status : 500
    const msg = (e as Error).message
    return NextResponse.json({ error: msg, ...(/uncommitted changes/.test(msg) && { dirty: true }) }, { status })
  } finally {
    releaseWorker(root, chat.id)
  }
}
