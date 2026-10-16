import { NextResponse } from 'next/server'
import { HubError } from '@/lib/core'
import { isDemo, isPlayground } from '@/lib/demo'

/** Hub writes (T531) aren't for the demo or `--demo` playground: their project is a temp copy, the hub is the user's. */
export function hubWritesForbidden() {
  return isDemo() || isPlayground() ? NextResponse.json({ error: 'Not available in the demo' }, { status: 403 }) : null
}

export function hubErrorResponse(e: unknown) {
  const status = e instanceof HubError ? e.status : 500
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status })
}
