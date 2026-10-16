import { NextRequest, NextResponse } from 'next/server'
import { updateHubProject } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../_shared'

/** T531: rename (display name only), pin or archive a hub project. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const { id, patch } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !patch || typeof patch !== 'object') return NextResponse.json({ error: 'id and patch required' }, { status: 400 })
  try {
    const project = await updateHubProject(id, patch)
    emitUpdate('projects_updated', { id })
    return NextResponse.json({ project })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
