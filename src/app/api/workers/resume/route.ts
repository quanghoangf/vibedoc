/**
 * POST /api/workers/resume {id} (R108 T556, ADR-007 decision 9)
 * A worker whose task process died while VibeDoc was down shows as interrupted. Resume continues that task's session
 * (`--resume <its session>`, cwd = the worktree: the only guard, spike run D) with "Continue task <id>.", then the loop
 * goes on. No session (it died before Claude Code printed one) → the task runs again fresh. 409 unless interrupted.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChat, readProjectSettings, rootFrom } from '@/lib/core'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { resumableTurn } from '@/lib/worker-loop'
import { reserveWorker, startWorker, type WorkerChat } from '@/lib/worker-runs'
import { workerDeps } from '../deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const { id } = await req.json().catch(() => ({})) as { id?: unknown }
  if (typeof id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const chat = await getChat(id, root).catch(() => null) as WorkerChat | null
  if (!chat?.worker) return NextResponse.json({ error: 'No worker with this id' }, { status: 404 })
  const turn = resumableTurn(chat.worker)
  if (turn?.result !== 'interrupted') return NextResponse.json({ error: 'This worker is not interrupted' }, { status: 409 })
  const { workers } = await readProjectSettings(root)
  const taken = reserveWorker(root, chat.id, chat.worker.target.id, workers.maxRunning, chat.worker.port)
  if (taken === 'epic') return NextResponse.json({ error: `A worker is already running on ${chat.worker.target.id}` }, { status: 409 })
  if (taken === 'limit') return NextResponse.json({ error: `The limit of ${workers.maxRunning} running workers is reached (Settings → Workers). Stop one, or wait.` }, { status: 409 })
  await startWorker(root, chat, workerDeps(root, chat, req.nextUrl.origin, workers), { message: `Continue task ${turn.taskId}.` })
  return NextResponse.json({ ok: true })
}
