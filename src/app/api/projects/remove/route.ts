import { NextRequest, NextResponse } from 'next/server'
import { removeHubProject } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../_shared'

/** T531: drop a project from the hub; its folder is untouched. Answers the entry, which /restore takes for Undo. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const entry = await removeHubProject(id)
    emitUpdate('projects_updated', { id })
    return NextResponse.json({ entry })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
