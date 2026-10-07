/**
 * GET /api/release-notes → { path, since: {tag, date} | null, section, edits, count } (R091). Read-only: the draft is
 * written by PUT /api/docs { path, edits } only after the user accepts the diff.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getReleaseNotesDraft } from '@/lib/core'
import { errorResponse, rootOf } from '../roadmap/_shared'

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getReleaseNotesDraft(rootOf(req)))
  } catch (e) {
    return errorResponse(e)
  }
}
