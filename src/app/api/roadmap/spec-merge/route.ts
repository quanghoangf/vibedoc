/**
 * GET  /api/roadmap/spec-merge?id=R069 → { epic, merges: [{ capability, path, before, after, isNew, errors }] }
 * POST /api/roadmap/spec-merge { id }  → writes the epic's ## Spec changes into docs/specs/<capability>.md and stamps
 * **Spec merged:** (R069). Recomputed from the files on disk; 409 when the epic isn't done or is already merged,
 * 400 when there are no spec changes or any capability has an error.
 */
import { NextRequest, NextResponse } from 'next/server'
import { applySpecMerge, previewSpecMerge } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'
import { errorResponse, jsonBody, rootOf } from '../_shared'

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await previewSpecMerge(String(req.nextUrl.searchParams.get('id') ?? ''), rootOf(req)))
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const { id } = await jsonBody(req)
    const { epic, paths } = await applySpecMerge(String(id ?? ''), rootOf(req), 'human')
    // `external`: an open editor splices the new text in, as it does for an agent's whole-file write
    for (const path of paths) emitUpdate('doc_updated', { path, actor: 'human', external: true })
    emitUpdate('roadmap_updated', { kind: 'update', id: epic.id })
    return NextResponse.json({ epic, paths })
  } catch (e) {
    return errorResponse(e)
  }
}
