/**
 * POST /api/tasks/manual-tests  { id, index, checked }
 * Ticks one item of a task's `## Manual tests` checklist (R043). Never changes the task status.
 * Bulk (Test review selection): { ids: string[], checked } ticks every manual item of each task (🤖 untouched)
 * → { results: [{ id, changed: number[] } | { id, error }] }; one task's failure doesn't stop the others.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rootFrom, setAllManualTestsChecked, setManualTestChecked } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null) as { id?: unknown; ids?: unknown; index?: unknown; checked?: unknown } | null
  if (Array.isArray(body?.ids)) {
    const ids = body.ids
    if (!ids.length || ids.length > 500 || !ids.every((id) => typeof id === 'string') || typeof body.checked !== 'boolean') {
      return NextResponse.json({ error: 'Expected { ids: string[] (1–500), checked: boolean }' }, { status: 400 })
    }
    const results = []
    for (const id of ids as string[]) {
      try {
        const { task, changed } = await setAllManualTestsChecked(id, body.checked, root)
        if (changed.length) emitUpdate('task_updated', { taskId: task.id, status: task.status, task })
        results.push({ id: task.id, changed })
      } catch (e) {
        results.push({ id, error: (e as Error).message })
      }
    }
    return NextResponse.json({ results })
  }
  if (typeof body?.id !== 'string' || !Number.isInteger(body.index) || typeof body.checked !== 'boolean') {
    return NextResponse.json({ error: 'Expected { id: string, index: integer, checked: boolean }' }, { status: 400 })
  }
  try {
    const task = await setManualTestChecked(body.id, body.index as number, body.checked, root)
    emitUpdate('task_updated', { taskId: task.id, status: task.status, task })
    return NextResponse.json({ task })
  } catch (e) {
    const message = (e as Error).message
    const status = e instanceof RangeError ? 400 : message.startsWith('Task not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
