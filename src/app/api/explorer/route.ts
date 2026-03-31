import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredRoot, listExplorerFiles, enrichDescription } from '@/lib/core'

export async function GET(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const files = await listExplorerFiles(root)
    return NextResponse.json(files)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 501 })
  }
  try {
    const body = await req.json()
    const root = (body.root as string) || getConfiguredRoot()
    const filePath = body.path as string
    if (!filePath) return NextResponse.json({ error: 'path is required' }, { status: 400 })
    const description = await enrichDescription(filePath, root)
    return NextResponse.json({ description, source: 'ai' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
