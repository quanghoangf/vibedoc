import { NextRequest, NextResponse } from 'next/server'
import { readMemory, updateMemory, rootFrom } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const memory = await readMemory(root)
  return NextResponse.json(memory)
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const { actor, ...params } = await req.json()
  try {
    await updateMemory(params, root, actor === 'ai' ? 'ai' : 'human')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.startsWith('Nothing to update')) return NextResponse.json({ error: message }, { status: 400 })
    throw e
  }
  emitUpdate('memory_updated', { root })
  return NextResponse.json({ ok: true })
}
