import { NextRequest, NextResponse } from 'next/server'
import { deleteRoadmapItem } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { id } = await jsonBody(req)
    const rid = String(id ?? '').trim().toUpperCase()
    // file + raw + position let the client undo via /api/roadmap/restore
    const deleted = await deleteRoadmapItem(rid, rootOf(req))
    emitUpdate('roadmap_updated', { kind: 'delete', id: rid })
    return NextResponse.json({ ok: true, file: deleted.item.file, raw: deleted.raw, position: deleted.position })
  } catch (e) {
    return errorResponse(e)
  }
}
