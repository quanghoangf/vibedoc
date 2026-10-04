import { NextRequest, NextResponse } from 'next/server'
import { restoreEntry } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../../roadmap/_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

/** Undo a delete from the Memory tab: write the entry file back (never over an existing id). */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { file, raw } = await jsonBody(req)
    const root = rootOf(req)
    const entry = await restoreEntry(file, raw, root)
    emitUpdate('memory_updated', { root, entryId: entry.id })
    return NextResponse.json({ entry })
  } catch (e) {
    return errorResponse(e)
  }
}
