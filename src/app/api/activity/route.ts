import { NextRequest, NextResponse } from 'next/server'
import { readActivity, getConfiguredRoot } from '@/lib/core'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')
  const events = await readActivity(root, limit)
  return NextResponse.json(events)
}
