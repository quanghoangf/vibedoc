import { NextRequest, NextResponse } from 'next/server'
import { listRuns, rootFrom } from '@/lib/core'
import { isRunTaskId } from '@/lib/runs-paths'

/** A task's recorded test runs (R059), newest first. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isRunTaskId(id)) return NextResponse.json({ error: 'Bad task id' }, { status: 400 })
  const runs = await listRuns(id, rootFrom(req.nextUrl.searchParams.get('root')))
  return NextResponse.json({ runs })
}
