import { NextRequest, NextResponse } from 'next/server'
import { deleteRoadmapItem } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../_shared'

export async function POST(req: NextRequest) {
  try {
    const { id } = await jsonBody(req)
    const rid = String(id ?? '').trim().toUpperCase()
    await deleteRoadmapItem(rid, rootOf(req))
    emitUpdate('roadmap_updated', { kind: 'delete', id: rid })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
