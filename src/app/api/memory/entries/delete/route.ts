import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, deleteEntry } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../../roadmap/_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

/** Delete a knowledge entry; returns { file, raw } so the client can undo via /restore. */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { id } = await jsonBody(req)
    const root = rootOf(req)
    const entry = await deleteEntry(String(id ?? ''), root, 'human').catch((e: unknown) => {
      if (e instanceof Error) throw new RoadmapError(e.message, /not found/.test(e.message) ? 404 : 400)
      throw e
    })
    emitUpdate('memory_updated', { root, entryId: entry.id })
    return NextResponse.json({ id: entry.id, file: entry.file, raw: entry.raw })
  } catch (e) {
    return errorResponse(e)
  }
}
