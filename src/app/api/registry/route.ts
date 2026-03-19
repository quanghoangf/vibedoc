import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredRoot, readRegistry, rebuildRegistry } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function GET(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const result = await readRegistry(root)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const result = await rebuildRegistry(root, 'human')
    emitUpdate('registry_rebuilt', { path: result.path, totalFiles: result.totalFiles })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
