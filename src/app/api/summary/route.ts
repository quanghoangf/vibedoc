import { NextRequest, NextResponse } from 'next/server'
import { getProjectSummary, getConfiguredRoot } from '@/lib/core'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const summary = await getProjectSummary(root)
  return NextResponse.json(summary)
}
