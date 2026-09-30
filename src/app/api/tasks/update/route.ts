import { NextRequest, NextResponse } from 'next/server'
import { updateTaskMeta, type TaskMetaPatch } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../roadmap/_shared'

export async function POST(req: NextRequest) {
  try {
    const { id, patch, actor } = await jsonBody(req)
    const task = await updateTaskMeta(String(id), (patch ?? {}) as TaskMetaPatch, rootOf(req), actor === 'ai' ? 'ai' : 'human')
    emitUpdate('task_updated', { taskId: task.id, status: task.status, task })
    return NextResponse.json({ task })
  } catch (e) {
    return errorResponse(e)
  }
}
