import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, writeRoadmapLayout, type RoadmapLayout } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { positions } = await jsonBody(req)
    if (!positions || typeof positions !== 'object' || Array.isArray(positions)) {
      throw new RoadmapError('positions must be an object of { id: { x, y } }')
    }
    const layout = await writeRoadmapLayout(positions as RoadmapLayout, rootOf(req))
    emitUpdate('roadmap_updated', { kind: 'layout' })
    return NextResponse.json({ layout })
  } catch (e) {
    return errorResponse(e)
  }
}
