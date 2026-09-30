import { NextRequest, NextResponse } from 'next/server'
import { restoreRoadmapItem } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../_shared'

export async function POST(req: NextRequest) {
  try {
    const { file, raw, position } = await jsonBody(req)
    const item = await restoreRoadmapItem(file, raw, position, rootOf(req))
    emitUpdate('roadmap_updated', { kind: 'restore', id: item.id })
    return NextResponse.json({ item })
  } catch (e) {
    return errorResponse(e)
  }
}
