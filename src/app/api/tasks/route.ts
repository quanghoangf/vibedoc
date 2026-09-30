import { NextRequest, NextResponse } from 'next/server'
import { listTasks, updateTaskStatus, getConfiguredRoot, TaskStatus } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const data = await listTasks(root)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const { taskId, status, actor } = await req.json()
  const who = actor === 'ai' ? 'ai' : 'human'
  const result = await updateTaskStatus(taskId, status as TaskStatus, root, who, { actor: who })
  emitUpdate('task_updated', { taskId, status, previousStatus: result.previousStatus, task: result.task })
  return NextResponse.json(result)
}
