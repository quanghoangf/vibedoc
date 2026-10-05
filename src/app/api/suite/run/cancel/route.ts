import { NextRequest, NextResponse } from 'next/server'
import { rootFrom } from '@/lib/core'
import { cancelRun, suiteState } from '@/lib/test-runner'
import { isDemo, demoForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/suite/run/cancel → stops the project's suite (R064); its end comes over SSE as `cancelled`. */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  if (!suiteState(root) || !cancelRun(root)) return NextResponse.json({ error: 'No suite is running' }, { status: 409 })
  return NextResponse.json({ suite: suiteState(root) })
}
