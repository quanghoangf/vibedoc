import { NextResponse } from 'next/server'

/** `VIBEDOC_DEMO=1`: the hosted read-only demo (R042). Server-only: the browser learns it from `/api/summary`. */
export function isDemo(): boolean {
  return process.env.VIBEDOC_DEMO === '1'
}

/** The answer every mutating route gives in demo mode. */
export function demoForbidden() {
  return NextResponse.json({ error: 'Read-only demo' }, { status: 403 })
}

/** First-run feedback (R086) may be asked and sent: never in the demo, nor with VIBEDOC_FEEDBACK=0 (CI, e2e). */
export function feedbackAvailable(): boolean {
  return !isDemo() && process.env.VIBEDOC_FEEDBACK !== '0'
}
