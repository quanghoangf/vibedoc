import { NextRequest, NextResponse } from 'next/server'
import { HubError, searchAll } from '@/lib/core'
import { parseLimit } from '@/lib/cross-search'

/**
 * GET /api/search?q=&scope=all|group:<slug>|project:<hub id> (R107): docs, tasks, epics and memory entries across
 * projects, grouped by project, best first. `&limit=` = hits per project (default 10, `all` = every hit; each group's
 * `total` counts them all). Cross-project, so no `?root=` (like /api/inbox). Read-only.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const scope = req.nextUrl.searchParams.get('scope') || 'all'
  try {
    return NextResponse.json(await searchAll(q, scope, parseLimit(req.nextUrl.searchParams.get('limit'))))
  } catch (e) {
    if (e instanceof HubError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
