import { NextRequest, NextResponse } from 'next/server'
import { locateHubProject } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../_shared'

/** T532: a project's folder moved; `{id, root}` points the same id at the new folder. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const { id, root } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const project = await locateHubProject(id, root)
    emitUpdate('projects_updated', { id })
    return NextResponse.json({ project })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
