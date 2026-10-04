import { NextRequest, NextResponse } from 'next/server'
import { logDecision, rootFrom } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const { actor, ...params } = await req.json()
  const result = await logDecision(params, root, actor || 'human')
  emitUpdate('decision_logged', result)
  return NextResponse.json(result)
}
