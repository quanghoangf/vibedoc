/**
 * /api/agent-connect (R081)
 * GET: the connection steps' evidence for the Connect panel (and R082 / R084): the newest MCP tool call.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rootFrom, getAgentConnection } from '@/lib/core'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const conn = await getAgentConnection(root)
  return NextResponse.json({ mcp: { connected: conn !== null, agent: conn?.agent ?? null, lastCall: conn?.lastCall ?? null } })
}
