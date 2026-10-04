/**
 * POST /api/tasks/review  { id, action: "approve" | "send-back", note? }
 * Resolves a task waiting in the optional Review status (R043): approve → done, send back → todo with the note.
 * Send back also reopens a done task (a failed run on finished work, /manual-tests). Both are recorded in the task's
 * `## Review` section. 400 = bad input or empty send-back note; 409 = approve on a task not in review, or send back
 * on one that is neither in review nor done (REVIEWABLE in src/lib/review.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { TaskStateError, approveTask, rootFrom, sendBackTask } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null) as { id?: unknown; action?: unknown; note?: unknown } | null
  const note = typeof body?.note === 'string' ? body.note : ''
  if (typeof body?.id !== 'string' || (body.action !== 'approve' && body.action !== 'send-back')) {
    return NextResponse.json({ error: 'Expected { id: string, action: "approve" | "send-back", note?: string }' }, { status: 400 })
  }
  if (body.action === 'send-back' && !note.trim()) {
    return NextResponse.json({ error: 'A note is required to send a task back' }, { status: 400 })
  }
  try {
    const result = body.action === 'approve' ? await approveTask(body.id, root, note) : await sendBackTask(body.id, note, root)
    emitUpdate('task_updated', { taskId: result.task.id, status: result.task.status, previousStatus: result.previousStatus, task: result.task })
    return NextResponse.json({ task: result.task })
  } catch (e) {
    const message = (e as Error).message
    const status = e instanceof TaskStateError ? 409 : message.startsWith('Task not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
