import { NextRequest, NextResponse } from 'next/server'
import { getWorker, rootFrom, workerDiff } from '@/lib/core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/workers/diff?id= → {commits, files: [{path, added, removed, patch}], cut}: the worker's branch since its base (R108 T563). */
export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const worker = await getWorker(id, root).catch(() => null)
  if (!worker) return NextResponse.json({ error: 'No worker with this id' }, { status: 404 })
  try {
    return NextResponse.json(await workerDiff(root, worker))
  } catch (e) {
    // e.g. the branch was deleted with the worktree
    console.warn(`worker diff ${id}: ${(e as Error).message.split('\n')[0]}`)
    return NextResponse.json({ error: `Could not read ${worker.branch}: ${(e as Error).message.split('\n')[0]}` }, { status: 409 })
  }
}
