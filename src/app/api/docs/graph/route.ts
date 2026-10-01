import { NextRequest, NextResponse } from 'next/server'
import { getDocGraph } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** The resolved link graph between every .md file (R056): `{nodes, edges, broken}`. */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getDocGraph(rootOf(req)))
  } catch (e) {
    return errorResponse(e)
  }
}
