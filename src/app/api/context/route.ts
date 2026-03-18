import { NextRequest, NextResponse } from 'next/server'
import { getContext, getConfiguredRoot } from '@/lib/core'

export async function POST(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { paths } = await req.json()
    if (!Array.isArray(paths)) return NextResponse.json({ error: 'paths must be an array' }, { status: 400 })
    const context = await getContext(paths as string[], root)
    return NextResponse.json({ context })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
