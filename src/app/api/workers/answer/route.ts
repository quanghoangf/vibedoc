/**
 * POST /api/workers/answer {id, message, questionId?, answers?} (R108 T558, ADR-007 decision 9)
 * A worker that stopped mid-task (it asked with vibedoc_ask_questions, or left the task in-progress) waits on the user.
 * The answer resumes that task's session (`--resume`, cwd = the worktree), then the loop goes on. Returns once the
 * turn runs, so the browser can follow it at GET /api/workers/stream?id=<id> (T556). 409 unless the worker is waiting.
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
  const body = await req.json().catch(() => null) as { id?: unknown; message?: unknown; questionId?: unknown; answers?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (typeof body?.id !== 'string' || !message) return NextResponse.json({ error: 'id and message are required' }, { status: 400 })
  const chat = await getChat(body.id, root).catch(() => null) as WorkerChat | null
  if (!chat?.worker) return NextResponse.json({ error: 'No worker with this id' }, { status: 404 })
  if (!resumableTurn(chat.worker)) return NextResponse.json({ error: 'This worker is not waiting on a task' }, { status: 409 })
  const { workers } = await readProjectSettings(root)
  const taken = reserveWorker(root, chat.id, chat.worker.target.id, workers.maxRunning, chat.worker.port)
  if (taken === 'epic') return NextResponse.json({ error: `A worker is already running on ${chat.worker.target.id}` }, { status: 409 })
  if (taken === 'limit') return NextResponse.json({ error: `The limit of ${workers.maxRunning} running workers is reached (Settings → Workers). Stop one, or wait.` }, { status: 409 })
  const answers = Array.isArray(body.answers) && body.answers.every(a => typeof a === 'string') ? body.answers as string[] : undefined
  const questionId = typeof body.questionId === 'string' ? body.questionId : undefined
  await startWorker(root, chat, workerDeps(root, chat, req.nextUrl.origin, workers), { message, questionId, answers })
  return NextResponse.json({ ok: true })
}
