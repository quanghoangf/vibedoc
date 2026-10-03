import { NextRequest, NextResponse } from 'next/server'
import { undoMerge } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../../../roadmap/_shared'

/** Undo a merge from the Memory tab: write back every file in `before` (never over a re-created dropped id). */
export async function POST(req: NextRequest) {
  try {
    const { before } = await jsonBody(req)
    const root = rootOf(req)
    const entries = await undoMerge(before, root, 'human')
    emitUpdate('memory_updated', { root })
    return NextResponse.json({ entries })
  } catch (e) {
    return errorResponse(e)
  }
}
