import { NextRequest, NextResponse } from 'next/server'
import { restoreMemoryVersion } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../roadmap/_shared'

/** Write a saved MEMORY.md version back (R045); the replaced file is snapshotted first, so this is undoable. */
export async function POST(req: NextRequest) {
  try {
    const root = rootOf(req)
    const { id, actor } = await jsonBody(req)
    const { restoredFrom, newId } = await restoreMemoryVersion(String(id ?? ''), root, actor === 'ai' ? 'ai' : 'human')
    emitUpdate('memory_updated', { root })
    // replacedId = the snapshot of the file this replaced; restoring it is the Undo
    return NextResponse.json({ ok: true, restoredFrom, replacedId: newId })
  } catch (e) {
    return errorResponse(e)
  }
}
