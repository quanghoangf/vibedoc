import { NextRequest, NextResponse } from 'next/server'
import { renameGroup } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../../projects/_shared'

/** R102: a group's display name, written into every member repo. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({}))
  try {
    const group = await renameGroup(body.slug, body.name)
    emitUpdate('projects_updated', { group: body.slug ?? group?.slug })
    return NextResponse.json({ group })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
