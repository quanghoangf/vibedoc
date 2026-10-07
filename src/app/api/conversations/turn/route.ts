/**
 * GET /api/conversations/turn?id=<chatId>  → the chat's current or just-ended agent turn as NDJSON: everything it
 *                                            printed so far, then live lines until it ends (404 when there is none)
 * GET /api/conversations/turn              → { turns: [{ id, running, startedAt, endedAt }] } for this project
 * Lets a reloaded page pick a running turn back up (src/lib/chat-turns.ts). Under /api/conversations so the e2e
 * `**\/api/chat**` stub never answers it.
 */
import { NextRequest } from 'next/server'
import { rootFrom } from '@/lib/core'
import { listTurns, turnStream } from '@/lib/chat-turns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ turns: listTurns(root) })
  const stream = turnStream(root, id, req.signal)
  if (!stream) return Response.json({ error: 'No turn for this chat' }, { status: 404 })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform' } })
}
