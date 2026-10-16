import { NextRequest, NextResponse } from 'next/server'
import { addHubProjects } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { crossOriginForbidden, hubErrorResponse, hubWritesForbidden } from '../_shared'

/** Adds folders to the hub: `{root}` or `{roots: []}` (R101). Every path must be a folder, else nothing is added. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden() ?? crossOriginForbidden(req)
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({}))
  const roots: unknown[] = Array.isArray(body?.roots) ? body.roots : body?.root !== undefined ? [body.root] : []
  try {
    const results = await addHubProjects(roots)
    if (results.some(r => r.added)) emitUpdate('projects_updated', { ids: results.map(r => r.project.id) })
    return NextResponse.json({ projects: results.map(r => ({ ...r.project, added: r.added })), id: results[0].project.id })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
