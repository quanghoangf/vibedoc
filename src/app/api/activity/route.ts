import { NextRequest, NextResponse } from 'next/server'
import { readActivity, rootFrom } from '@/lib/core'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')
  const events = await readActivity(root, limit)
  return NextResponse.json(events)
}
