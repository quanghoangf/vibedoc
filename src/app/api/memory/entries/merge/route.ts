import { NextRequest, NextResponse } from 'next/server'
import { mergeEntries } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../../roadmap/_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

/** Approve a duplicate merge: { keepId, dropIds, type, summary, body } → { entry, before } (before feeds /merge/undo). */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { keepId, dropIds, type, summary, body } = await jsonBody(req)
    const root = rootOf(req)
    const { entry, before } = await mergeEntries({ keepId, dropIds, type, summary, body }, root, 'human')
    emitUpdate('memory_updated', { root, entryId: entry.id })
    return NextResponse.json({ entry, before })
  } catch (e) {
    return errorResponse(e)
  }
}
