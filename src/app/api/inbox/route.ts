import { NextRequest, NextResponse } from 'next/server'
import { getInbox } from '@/lib/core'

/**
 * GET /api/inbox[?project=<hub id>][&group=<slug>]: what waits on the user in every hub project (R105), newest first.
 * Cross-project, so no `?root=`; `?group=` keeps the members of one project group (R102), an unknown group nothing.
 * Read-only: the page refreshes on the SSE events the items already emit.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  return NextResponse.json(await getInbox({ project: q.get('project'), group: q.get('group') }))
}
