import { NextRequest, NextResponse } from 'next/server'
import { findBacklinks, getConfiguredRoot } from '@/lib/core'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const docPath = req.nextUrl.searchParams.get('path')
  if (!docPath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 })
  }
  const links = await findBacklinks(docPath, root)
  return NextResponse.json({ links })
}
