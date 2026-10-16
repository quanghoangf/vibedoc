import { NextRequest, NextResponse } from 'next/server'
import { createGroup } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../../projects/_shared'

/** R102: a new group {name, members: project ids}; `slug` only from Undo of delete. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({}))
  try {
    const group = await createGroup(body.name, body.members, body.slug)
    emitUpdate('projects_updated', { group: body.slug ?? group?.slug })
    return NextResponse.json({ group })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
