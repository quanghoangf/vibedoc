/**
 * GET /api/openapi                       → the project's OpenAPI spec as an endpoint list (R094)
 *   { path: null } no spec · { path, error } unreadable · { path, title, endpoints }
 * GET /api/openapi?method=GET&path=/x    → one endpoint's detail (404 when the spec has no such endpoint)
 * Read-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readOpenApi, rootFrom } from '@/lib/core'
import { endpointDetail, listEndpoints } from '@/lib/openapi'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const file = await readOpenApi(rootFrom(sp.get('root')))
  if (!file) return NextResponse.json({ path: null })
  if ('error' in file) return NextResponse.json({ path: file.path, error: file.error })
  const method = sp.get('method')
  const path = sp.get('path')
  if (method && path) {
    const detail = endpointDetail(file.spec, method, path)
    if (!detail) return NextResponse.json({ error: `No endpoint ${method.toUpperCase()} ${path}` }, { status: 404 })
    return NextResponse.json(detail)
  }
  const title = [file.spec.info?.title, file.spec.info?.version].filter(Boolean).join(' ')
  return NextResponse.json({ path: file.path, title, endpoints: listEndpoints(file.spec) })
}
