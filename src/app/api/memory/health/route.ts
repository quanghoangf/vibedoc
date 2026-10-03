import { NextRequest, NextResponse } from 'next/server'
import { getMemoryHealth } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** Memory health flags for the Cleanup panel (R051). `?dismissed=1` also returns dismissed flags, marked `dismissed`. */
export async function GET(req: NextRequest) {
  try {
    const includeDismissed = req.nextUrl.searchParams.get('dismissed') === '1'
    return NextResponse.json({ flags: await getMemoryHealth(rootOf(req), { includeDismissed }) })
  } catch (e) {
    return errorResponse(e)
  }
}
