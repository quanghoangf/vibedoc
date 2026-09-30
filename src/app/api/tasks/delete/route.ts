import { NextRequest, NextResponse } from 'next/server'
import { deleteTask } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../roadmap/_shared'

export async function POST(req: NextRequest) {
  try {
    const { id, actor } = await jsonBody(req)
    const task = await deleteTask(String(id), rootOf(req), actor === 'ai' ? 'ai' : 'human')
    emitUpdate('task_updated', { taskId: task.id, deleted: true })
    emitUpdate('roadmap_updated', { kind: 'task-deleted', id: task.id })
    // raw lets the client restore the file (Undo, T077)
    return NextResponse.json({ task })
  } catch (e) {
    return errorResponse(e)
  }
}
