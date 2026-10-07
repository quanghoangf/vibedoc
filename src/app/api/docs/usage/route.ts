import { NextRequest, NextResponse } from 'next/server'
import { getDocUsage } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** R093: which docs agents read, which they never read, and agent searches that found nothing. */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getDocUsage(rootOf(req)))
  } catch (e) {
    return errorResponse(e)
  }
}
