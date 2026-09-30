/**
 * POST /api/tasks/manual-tests  { id, index, checked }
 * Ticks one item of a task's `## Manual tests` checklist (R043). Never changes the task status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredRoot, setManualTestChecked } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const body = await req.json().catch(() => null) as { id?: unknown; index?: unknown; checked?: unknown } | null
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
