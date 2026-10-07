import { NextRequest, NextResponse } from 'next/server'
import { listTasks, updateTaskStatus, rootFrom, TaskStatus } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const data = await listTasks(root)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const { taskId, status, actor } = await req.json()
  const who = actor === 'ai' ? 'ai' : 'human'
  const result = await updateTaskStatus(taskId, status as TaskStatus, root, who, { actor: who })
  emitUpdate('task_updated', { taskId, status, previousStatus: result.previousStatus, task: result.task })
  // the task file open in /docs splices the new meta line into its buffer (T505)
  if (result.task?.file) emitUpdate('doc_updated', { path: result.task.file, actor: who, external: true })
  return NextResponse.json(result)
}
