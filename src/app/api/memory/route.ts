import { NextRequest, NextResponse } from 'next/server'
import { readMemory, updateMemory, getConfiguredRoot } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const memory = await readMemory(root)
  return NextResponse.json(memory)
}

export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const { actor, ...params } = await req.json()
  await updateMemory(params, root, actor || 'human')
  emitUpdate('memory_updated', { root })
  return NextResponse.json({ ok: true })
}
