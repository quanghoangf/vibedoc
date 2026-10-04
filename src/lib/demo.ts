import { NextResponse } from 'next/server'

/** `VIBEDOC_DEMO=1`: the hosted read-only demo (R042). Server-only: the browser learns it from `/api/summary`. */
export function isDemo(): boolean {
  return process.env.VIBEDOC_DEMO === '1'
}

/** The answer every mutating route gives in demo mode. */
export function demoForbidden() {
  return NextResponse.json({ error: 'Read-only demo' }, { status: 403 })
}
