import { NextRequest, NextResponse } from 'next/server'
import { getInbox } from '@/lib/core'

/**
 * GET /api/inbox[?project=<hub id>]: what waits on the user in every hub project (R105), newest first.
 * Cross-project, so no `?root=`. `?group=` arrives with project groups (T538); until then it is ignored.
 * Read-only: the page refreshes on the SSE events the items already emit.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(await getInbox({ project: req.nextUrl.searchParams.get('project') }))
}
