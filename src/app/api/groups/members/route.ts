import { NextRequest, NextResponse } from 'next/server'
import { setGroupMembers } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../../projects/_shared'

/** R102: add / remove member projects (ids); group null once its last member left. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({}))
  try {
    const group = await setGroupMembers(body.slug, body.add, body.remove)
    emitUpdate('projects_updated', { group: body.slug ?? group?.slug })
    return NextResponse.json({ group })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
