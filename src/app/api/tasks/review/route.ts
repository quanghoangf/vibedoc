/**
 * POST /api/tasks/review  { id, action: "approve" | "send-back", note?, runId?, marks? }
 * Resolves a task waiting in the optional Review status (R043): approve → done, send back → todo with the note.
 * Send back also reopens a done task (a failed run on finished work, /manual-tests). Both are recorded in the task's
 * `## Review` section. 400 = bad input or empty send-back note; 409 = approve on a task not in review, or send back
 * on one that is neither in review nor done (REVIEWABLE in src/lib/review.ts).
 * R062: `runId` = the kept run the decision was made from; `marks` = flagged steps ({ item, step, kind:
 * "doubt" | "failed", comment?, screenshot? }) written into the entry. A send back needs a note or a mark.
 */

import { NextRequest, NextResponse } from 'next/server'
import { TaskStateError, approveTask, rootFrom, sendBackTask } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'
import { isRunFile, isRunId } from '@/lib/runs-paths'
import { REVIEW_MARK_KINDS, type ReviewMark } from '@/lib/review'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null) as { id?: unknown; action?: unknown; note?: unknown; runId?: unknown; marks?: unknown } | null
  const note = typeof body?.note === 'string' ? body.note : ''
  if (typeof body?.id !== 'string' || (body.action !== 'approve' && body.action !== 'send-back')) {
    return NextResponse.json({ error: 'Expected { id: string, action: "approve" | "send-back", note?: string }' }, { status: 400 })
  }
  const runId = body.runId == null ? null : String(body.runId)
  if (runId !== null && !isRunId(runId)) return NextResponse.json({ error: `Bad runId: ${runId}` }, { status: 400 })
  const marks = parseMarks(body.marks)
  if (typeof marks === 'string') return NextResponse.json({ error: marks }, { status: 400 })
  if (body.action === 'send-back' && !note.trim() && !marks.length) {
    return NextResponse.json({ error: 'A note or a flagged step is required to send a task back' }, { status: 400 })
  }
  try {
    const result = body.action === 'approve' ? await approveTask(body.id, root, note, { runId }) : await sendBackTask(body.id, note, root, { runId, marks })
    emitUpdate('task_updated', { taskId: result.task.id, status: result.task.status, previousStatus: result.previousStatus, task: result.task })
    return NextResponse.json({ task: result.task })
  } catch (e) {
    const message = (e as Error).message
    const status = e instanceof TaskStateError ? 409 : e instanceof RangeError ? 400 : message.startsWith('Task not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

/** The marks of a request, or an error message. */
function parseMarks(raw: unknown): ReviewMark[] | string {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > 100) return 'marks must be an array (at most 100)'
  const out: ReviewMark[] = []
  for (const m of raw as Record<string, unknown>[]) {
    if (!Number.isInteger(m?.item) || (m.item as number) < 0) return 'A mark needs item: the checklist index (0 or more)'
    if (typeof m.step !== 'string' || !m.step.trim() || m.step.length > 500) return 'A mark needs step: the step text'
    if (!REVIEW_MARK_KINDS.includes(m.kind as ReviewMark['kind'])) return `A mark's kind is "doubt" or "failed", got ${JSON.stringify(m.kind)}`
    if (m.comment != null && (typeof m.comment !== 'string' || m.comment.length > 2000)) return 'A mark comment is a string'
    if (m.screenshot != null && (typeof m.screenshot !== 'string' || !isRunFile(m.screenshot))) return `Bad screenshot file: ${m.screenshot}`
    out.push({
      item: m.item as number, step: m.step, kind: m.kind as ReviewMark['kind'],
      ...(typeof m.comment === 'string' && m.comment.trim() ? { comment: m.comment } : {}),
      ...(typeof m.screenshot === 'string' ? { screenshot: m.screenshot } : {}),
    })
  }
  return out
}
