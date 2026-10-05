import { NextRequest, NextResponse } from 'next/server'
import { rootFrom } from '@/lib/core'
import { cancelRun, runState } from '@/lib/test-runner'
import { isDemo, demoForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/tasks/run/cancel → stops the project's run (R061); its end comes over SSE as `cancelled`. */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  if (!cancelRun(root)) return NextResponse.json({ error: 'Nothing is running' }, { status: 409 })
  return NextResponse.json({ run: runState(root) })
}
