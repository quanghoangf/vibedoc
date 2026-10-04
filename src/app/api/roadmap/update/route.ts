import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, updateRoadmapItem, type UpdateRoadmapItemPatch } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { id, patch } = await jsonBody(req)
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new RoadmapError('patch must be an object')
    const item = await updateRoadmapItem(String(id ?? ''), patch as UpdateRoadmapItemPatch, rootOf(req))
    emitUpdate('roadmap_updated', { kind: 'update', id: item.id })
    return NextResponse.json({ item })
  } catch (e) {
    return errorResponse(e)
  }
}
