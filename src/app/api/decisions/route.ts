import { NextRequest, NextResponse } from 'next/server'
import { logDecision, getConfiguredRoot } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const { actor, ...params } = await req.json()
  const result = await logDecision(params, root, actor || 'human')
  emitUpdate('decision_logged', result)
  return NextResponse.json(result)
}
