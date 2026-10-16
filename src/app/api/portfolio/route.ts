import { NextResponse } from 'next/server'
import { getPortfolio } from '@/lib/core'

/** GET /api/portfolio: every hub project (groups as one row, members nested), most attention first (R106). Cross-project, read-only. */
export async function GET() {
  return NextResponse.json(await getPortfolio())
}
