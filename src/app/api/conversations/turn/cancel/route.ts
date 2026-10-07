/** POST /api/conversations/turn/cancel { id } — Stop: kills the chat's running `claude -p` turn (src/lib/chat-turns.ts). */
import { NextRequest } from 'next/server'
import { rootFrom } from '@/lib/core'
import { cancelTurn } from '@/lib/chat-turns'
import { isDemo, demoForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !id) return Response.json({ error: 'id is required' }, { status: 400 })
  return Response.json({ stopped: cancelTurn(root, id) })
}
