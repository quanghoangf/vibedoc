import { NextRequest, NextResponse } from 'next/server'
import { updateTaskMeta, type TaskMetaPatch } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../roadmap/_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { id, patch, actor } = await jsonBody(req)
    const task = await updateTaskMeta(String(id), (patch ?? {}) as TaskMetaPatch, rootOf(req), actor === 'ai' ? 'ai' : 'human')
    emitUpdate('task_updated', { taskId: task.id, status: task.status, task })
    // the task file open in /docs splices the new meta lines into its buffer (T505)
    emitUpdate('doc_updated', { path: task.file, actor: actor === 'ai' ? 'ai' : 'human', external: true })
    return NextResponse.json({ task })
  } catch (e) {
    return errorResponse(e)
  }
}
