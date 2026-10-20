/**
 * /api/conversations
 * Saved agent chats (.vibedoc/chats/<id>.json). The live turn itself runs through /api/chat.
 * Named "conversations", not "chats", so it never matches the e2e `**\/api/chat**` stub.
 */

import { NextRequest, NextResponse } from 'next/server'
import { deleteChat, rootFrom, listChats, saveChat } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'
import { resumePausedWorkers } from '../workers/deps'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  // T567: a worker paused on a usage limit before a restart goes on (its loop is not in memory any more)
  if (!isDemo()) void resumePausedWorkers(root, req.nextUrl.origin).catch(e => console.warn(`[vibedoc] paused workers not resumed: ${(e as Error).message}`))
  return NextResponse.json({ chats: await listChats(root) })
}

// body: { chat } to save, or { delete: id }
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  try {
    const body = await req.json()
    if (typeof body?.delete === 'string') {
      await deleteChat(body.delete, root)
      emitUpdate('chat_saved', { id: body.delete, deleted: true })
    } else {
      await saveChat(body?.chat, root)
      emitUpdate('chat_saved', { id: body?.chat?.id })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
