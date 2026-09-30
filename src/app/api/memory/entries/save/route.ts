import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, saveEntry } from '@/lib/core'
import { validateEntryInput, type EntryInput } from '@/lib/entries'
import { emitUpdate } from '@/lib/events'
import { errorResponse, jsonBody, rootOf } from '../../../roadmap/_shared'

/** Create (no id) or update (id) a knowledge entry from the Memory tab. */
export async function POST(req: NextRequest) {
  try {
    const body = await jsonBody(req)
    const input = { id: body.id ?? undefined, type: body.type, summary: body.summary, body: body.body ?? '' } as EntryInput
    // validation errors are the user's to fix → 400, not 500
    const invalid = validateEntryInput(input)
    if (invalid) throw new RoadmapError(invalid)
    const root = rootOf(req)
    const entry = await saveEntry(input, root, 'human').catch((e: unknown) => {
      throw e instanceof Error && /not found/.test(e.message) ? new RoadmapError(e.message, 404) : e
    })
    emitUpdate('memory_updated', { root, entryId: entry.id })
    return NextResponse.json({ entry })
  } catch (e) {
    return errorResponse(e)
  }
}
