import { NextRequest, NextResponse } from 'next/server'
import { createRoadmapItem, type CreateRoadmapItemParams } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const body = await jsonBody(req)
    const item = await createRoadmapItem(body as unknown as CreateRoadmapItemParams, rootOf(req))
    emitUpdate('roadmap_updated', { kind: 'create', id: item.id })
    return NextResponse.json({ item }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
