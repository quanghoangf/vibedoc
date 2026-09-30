import { NextRequest, NextResponse } from 'next/server'
import { listEntries } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** Every knowledge entry (R046) with its body, for the Memory tab. */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ entries: await listEntries(rootOf(req)) })
  } catch (e) {
    return errorResponse(e)
  }
}
