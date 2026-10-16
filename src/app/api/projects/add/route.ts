import { NextRequest, NextResponse } from 'next/server'
import { addHubProjects } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../_shared'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Adds folders to the hub: `{root}` or `{roots: []}` (R101); every path must be a folder, else nothing is added.
 * Callers: the app itself (same origin), or the `vibedoc` CLI on this machine (R100), which sends no Origin, so it
 * must say `x-vibedoc-cli: 1` and talk to a localhost address. Replies `{projects, id}` (`id` = the first project).
 */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden()
  if (forbidden) return forbidden
  const origin = req.headers.get('origin')
  let allowed = req.headers.get('sec-fetch-site') !== 'cross-site'
  if (origin) {
    try { if (new URL(origin).host !== req.nextUrl.host) allowed = false } catch { allowed = false }
  } else if (req.headers.get('x-vibedoc-cli') !== '1' || !LOCAL_HOSTS.has(req.nextUrl.hostname)) {
    allowed = false
  }
  if (!allowed) return NextResponse.json({ error: 'Only this machine can add projects' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const roots: unknown[] = Array.isArray(body?.roots) ? body.roots : body?.root !== undefined ? [body.root] : []
  try {
    const results = await addHubProjects(roots)
    if (results.some(r => r.added)) emitUpdate('projects_updated', { ids: results.map(r => r.project.id) })
    const first = results[0]
    return NextResponse.json({ projects: results.map(r => ({ ...r.project, added: r.added })), id: first.project.id, added: first.added })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
