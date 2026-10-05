import { NextResponse, type NextRequest } from 'next/server'

/** Starts processes: same-origin JSON only (a JSON content type forces a CORS preflight). Null = ok. */
export function refuseCrossSite(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin')
  let sameOrigin = req.headers.get('sec-fetch-site') !== 'cross-site'
  try { if (origin && new URL(origin).host !== req.nextUrl.host) sameOrigin = false } catch { sameOrigin = false }
  if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }
  return null
}
