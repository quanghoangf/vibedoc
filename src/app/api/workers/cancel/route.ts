import { NextRequest, NextResponse } from 'next/server'
import { rootFrom } from '@/lib/core'
import { cancelWorker } from '@/lib/worker-runs'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/workers/cancel {id} → kills the worker's current task (it stays in-progress); phase → stopped (R108 T554). */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const { id } = await req.json().catch(() => ({})) as { id?: unknown }
  if (typeof id !== 'string' || !cancelWorker(root, id)) return NextResponse.json({ error: 'No running worker with this id' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
