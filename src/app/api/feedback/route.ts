/**
 * /api/feedback
 * First-run feedback (R086): the project's answer (.vibedoc/feedback.json) and the steps waiting to be sent.
 * The browser sends them (stepUrl), never this server. Off in the read-only demo and with VIBEDOC_FEEDBACK=0.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rootFrom, readFeedback, saveFeedback, firstRunReached } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { applyConsent, lastStep, pendingSteps } from '@/lib/first-run'
import { VIBEDOC_VERSION } from '@/lib/version'
import { feedbackAvailable, demoForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'

/** `version` + `lastStep` feed the "Stuck? Tell us" link, which works with or without consent. */
export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const reached = await firstRunReached(root)
  const stuck = { version: VIBEDOC_VERSION, lastStep: lastStep(reached) }
  if (!feedbackAvailable()) return NextResponse.json({ available: false, consent: null, pending: [], ...stuck })
  const state = await readFeedback(root)
  return NextResponse.json({ available: true, consent: state.consent, pending: pendingSteps(state, reached), ...stuck })
}

export async function POST(req: NextRequest) {
  if (!feedbackAvailable()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const body = await req.json().catch(() => null)
  if (typeof body?.consent !== 'boolean') return NextResponse.json({ error: 'consent must be true or false' }, { status: 400 })
  const [state, reached] = await Promise.all([readFeedback(root), firstRunReached(root)])
  const next = applyConsent(state, body.consent, reached, new Date().toISOString())
  await saveFeedback(root, next)
  emitUpdate('feedback_updated', { consent: next.consent })
  return NextResponse.json({ consent: next.consent, pending: pendingSteps(next, reached) })
}
