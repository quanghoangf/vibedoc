import { NextRequest, NextResponse } from 'next/server'
import { applyPlan, getTask } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../roadmap/_shared'

/** POST { plan, selected } → writes the selected plan items. 400 { error } on validation errors. */
export async function POST(req: NextRequest) {
  try {
    const { plan, selected } = await jsonBody(req)
    const root = rootOf(req)
    const { created, epic } = await applyPlan(plan, selected, root)
    if ((plan as { kind?: unknown } | null)?.kind === 'roadmap') {
      emitUpdate('roadmap_updated', { kind: 'create', ids: created.map(c => c.id) })
    } else {
      for (const c of created) emitUpdate('task_created', { task: await getTask(c.id, root) })
      if (epic) emitUpdate('roadmap_updated', { kind: 'update', id: epic.id })
    }
    return NextResponse.json({ created })
  } catch (e) {
    return errorResponse(e)
  }
}
