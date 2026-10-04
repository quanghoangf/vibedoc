import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, rootFrom } from '@/lib/core'

export function rootOf(req: NextRequest): string {
  return rootFrom(req.nextUrl.searchParams.get('root'))
}

/** Parse a JSON object body; throws RoadmapError (400) on malformed input. */
export async function jsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new RoadmapError('Invalid JSON body')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RoadmapError('Body must be a JSON object')
  return body as Record<string, unknown>
}

export function errorResponse(e: unknown) {
  const status = e instanceof RoadmapError ? e.status : 500
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status })
}
