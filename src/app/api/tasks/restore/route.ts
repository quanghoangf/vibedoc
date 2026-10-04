import { NextRequest, NextResponse } from 'next/server'
import { restoreTask, type TaskLink } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../roadmap/_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { file, raw, links } = await jsonBody(req)
    const task = await restoreTask(file, raw, (Array.isArray(links) ? links : []) as TaskLink[], rootOf(req))
    emitUpdate('task_created', { task })
    emitUpdate('roadmap_updated', { kind: 'task-restored', id: task.id })
    return NextResponse.json({ task })
  } catch (e) {
    return errorResponse(e)
  }
}
