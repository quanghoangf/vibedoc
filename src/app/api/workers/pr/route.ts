/**
 * POST /api/workers/pr {id} (R108 T564)
 * Pushes a finished worker's branch and opens a PR against its base (`git push -u origin` + `gh pr create --fill`,
 * src/lib/git-actions.ts), the user's action after a confirm. → {url}, saved as `worker.prUrl`. Without `gh` or its
 * login → 409 with `commands` for the user to run (nothing pushed).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChat, rootFrom } from '@/lib/core'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { openPr } from '@/lib/git-actions'
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
  if (!FINISHED.includes(chat.worker.phase)) return NextResponse.json({ error: 'Stop the worker before you open a PR' }, { status: 409 })
  if (reserveWorker(root, chat.id, chat.worker.target.id)) return NextResponse.json({ error: 'This worker is running' }, { status: 409 })
  try {
    const pr = await openPr(root, chat.worker)
    if (!pr.ok) return NextResponse.json({ error: pr.reason, commands: pr.commands }, { status: 409 })
    const now = new Date().toISOString()
    chat.worker = { ...chat.worker, prUrl: pr.url }
    chat.updatedAt = now
    await saveWorkerChat(root)(chat)
    return NextResponse.json({ ok: true, url: pr.url })
  } finally {
    releaseWorker(root, chat.id)
  }
}
