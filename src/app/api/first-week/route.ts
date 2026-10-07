import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, setFirstWeekDismissed } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../roadmap/_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

/** R084: `{ dismissed: true }` hides the first-week checklist for this project, `false` brings it back (Undo). */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { dismissed } = await jsonBody(req)
    if (typeof dismissed !== 'boolean') throw new RoadmapError('dismissed must be true or false')
    await setFirstWeekDismissed(rootOf(req), dismissed)
    emitUpdate('first_week_updated', { dismissed })
    return NextResponse.json({ dismissed })
  } catch (e) {
    return errorResponse(e)
  }
}
