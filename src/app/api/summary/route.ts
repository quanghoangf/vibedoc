import { NextRequest, NextResponse } from 'next/server'
import { getProjectSummary, rootFrom } from '@/lib/core'
import { isDemo, isPlayground } from '@/lib/demo'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const summary = await getProjectSummary(root)
  return NextResponse.json({ ...summary, demo: isDemo(), playground: isPlayground() })
}
