import { NextRequest, NextResponse } from 'next/server'
import { deleteGroup } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../../projects/_shared'

/** R102: the slug leaves every member's settings; answers the group, which /create takes back for Undo. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({}))
  try {
    const group = await deleteGroup(body.slug)
    emitUpdate('projects_updated', { group: body.slug ?? group?.slug })
    return NextResponse.json({ group })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
