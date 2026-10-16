import { NextRequest, NextResponse } from 'next/server'
import { cloneProject } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { crossOriginForbidden, hubErrorResponse, hubWritesForbidden } from '../_shared'

/** Clone from git (T537): `{url, parent}` → the repo cloned into `<parent>/<name>` and added; progress as SSE `project_clone`. */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden() ?? crossOriginForbidden(req)
  if (forbidden) return forbidden
  const { url, parent } = await req.json().catch(() => ({}))
  try {
    const project = await cloneProject(url, parent, line => emitUpdate('project_clone', { url, line }))
    emitUpdate('projects_updated', { id: project.id })
    return NextResponse.json({ project })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
