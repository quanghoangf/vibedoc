/** POST /api/feedback/sent { step }: the browser sent this first-run step (R086); it is never sent again. */

import { NextRequest, NextResponse } from 'next/server'
import { rootFrom, readFeedback, saveFeedback } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isStep, markSent } from '@/lib/first-run'
import { feedbackAvailable, demoForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!feedbackAvailable()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null)
  if (!isStep(body?.step)) return NextResponse.json({ error: 'unknown step' }, { status: 400 })
  const state = await readFeedback(root)
  if (state.consent !== true) return NextResponse.json({ error: 'not opted in' }, { status: 409 })
  await saveFeedback(root, markSent(state, body.step))
  emitUpdate('feedback_updated', { step: body.step })
  return NextResponse.json({ ok: true })
}
