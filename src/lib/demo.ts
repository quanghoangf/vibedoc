import { NextResponse } from 'next/server'

/** `VIBEDOC_DEMO=1`: the hosted read-only demo (R042). Server-only: the browser learns it from `/api/summary`. */
export function isDemo(): boolean {
  return process.env.VIBEDOC_DEMO === '1'
}

/** The answer every mutating route gives in demo mode. */
export function demoForbidden() {
  return NextResponse.json({ error: 'Read-only demo' }, { status: 403 })
}

/** `VIBEDOC_PLAYGROUND=1`: `vibedoc --demo` (R085), the sample in a throwaway temp copy. Writable, but locked to that copy. */
export function isPlayground(): boolean {
  return process.env.VIBEDOC_PLAYGROUND === '1'
}

/** The answer of routes that spawn agents or processes (chat, test runs, the frontend app) in `vibedoc --demo`. */
export function playgroundForbidden() {
  return NextResponse.json({ error: 'Not available in the demo' }, { status: 403 })
}
