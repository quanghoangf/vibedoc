/**
 * POST /api/tasks/review/undo  { file, before, after }  (the `undo` of a POST /api/tasks/review reply)
 * Puts the task file back exactly as it was before an approve / send back. 409 when the file changed since the
 * decision (it no longer reads `after`), 400 on a bad file path.
 */

import { NextRequest, NextResponse } from 'next/server'
import { TaskStateError, rootFrom, undoReview } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null) as { file?: unknown; before?: unknown; after?: unknown } | null
  try {
    const result = await undoReview(body?.file, body?.before, body?.after, root)
    emitUpdate('task_updated', { taskId: result.task.id, status: result.task.status, previousStatus: result.previousStatus, task: result.task })
    return NextResponse.json({ task: result.task })
  } catch (e) {
    const message = (e as Error).message
    const status = e instanceof TaskStateError ? 409 : e instanceof RangeError ? 400 : message.startsWith('Task not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
