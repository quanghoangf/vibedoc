import { NextRequest, NextResponse } from 'next/server'
import { restoreHubProject } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../_shared'

/** T531: Undo of remove, the same entry back (never over an id or folder that is in the hub again). */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const { entry } = await req.json().catch(() => ({}))
  try {
    await restoreHubProject(entry)
    emitUpdate('projects_updated', { id: entry?.id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
