/**
 * POST /api/workers/merge {id} (R108 T564)
 * Merges a finished worker's branch into its base in the main checkout (`git merge --no-ff`, src/lib/git-actions.ts),
 * the user's action after a confirm. Refused (409, `offerPr`) when the checkout is on another branch, has uncommitted
 * changes outside VibeDoc's files, or the merge conflicts (aborted, never resolved). Saves `worker.mergedAt`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChat, rootFrom } from '@/lib/core'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { mergeBranch } from '@/lib/git-actions'
import { releaseWorker, reserveWorker, type WorkerChat } from '@/lib/worker-runs'
import type { WorkerPhase } from '@/lib/chats'
import { saveWorkerChat } from '../deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FINISHED: WorkerPhase[] = ['ended', 'stopped', 'failed']

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => ({})) as { id?: unknown }
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const chat = await getChat(body.id, root).catch(() => null) as WorkerChat | null
  if (!chat?.worker) return NextResponse.json({ error: 'No worker with this id' }, { status: 404 })
  if (!FINISHED.includes(chat.worker.phase)) return NextResponse.json({ error: 'Stop the worker before you merge its branch' }, { status: 409 })
  // hold it, so no run starts on this branch while it merges
  if (reserveWorker(root, chat.id, chat.worker.target.id)) return NextResponse.json({ error: 'This worker is running' }, { status: 409 })
  try {
    const merged = await mergeBranch(root, chat.worker)
    if (!merged.ok) return NextResponse.json({ error: merged.reason, files: merged.files, offerPr: true }, { status: 409 })
    const now = new Date().toISOString()
    chat.worker = { ...chat.worker, mergedAt: now }
    chat.updatedAt = now
    await saveWorkerChat(root)(chat)
    return NextResponse.json({ ok: true, sha: merged.sha })
  } finally {
    releaseWorker(root, chat.id)
  }
}
