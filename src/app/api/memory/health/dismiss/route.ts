import { NextRequest, NextResponse } from 'next/server'
import { dismissHealthFlag } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../../roadmap/_shared'

/** Dismiss a memory health flag: `{ id }` → stored in memory/.cleanup.json until the flag's id changes. */
export async function POST(req: NextRequest) {
  try {
    const { id } = await jsonBody(req)
    const root = rootOf(req)
    const flag = await dismissHealthFlag(String(id ?? ''), root, 'human')
    emitUpdate('memory_updated', { root, flagId: flag.id })
    return NextResponse.json({ flag })
  } catch (e) {
    return errorResponse(e)
  }
}
