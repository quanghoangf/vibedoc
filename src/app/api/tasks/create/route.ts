import { NextRequest, NextResponse } from 'next/server'
import { createTask, rootFrom, type CreateTaskParams } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
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
