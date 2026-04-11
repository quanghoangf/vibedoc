import { NextRequest, NextResponse } from 'next/server'
import { createTask, getConfiguredRoot, type CreateTaskParams } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const body = await req.json() as CreateTaskParams

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    const task = await createTask(body, root)
    emitUpdate('task_created', { task })
    return NextResponse.json({ task }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
