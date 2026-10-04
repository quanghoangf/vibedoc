import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, bulkTasks, type BulkTaskAction } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../roadmap/_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { ids, action } = await jsonBody(req)
    if (!Array.isArray(ids) || ids.length === 0 || !action || typeof action !== 'object') {
      throw new RoadmapError('Body needs ids: string[] and an action')
    }
    const result = await bulkTasks(ids.map(String), action as BulkTaskAction, rootOf(req))
    // One refresh for the whole batch
    emitUpdate('task_updated', { taskIds: ids, bulk: true })
    emitUpdate('roadmap_updated', { kind: 'bulk-tasks' })
    return NextResponse.json(result)
  } catch (e) {
    return errorResponse(e)
  }
}
