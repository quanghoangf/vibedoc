import { NextRequest, NextResponse } from 'next/server'
import { addHubProject } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { hubErrorResponse, hubWritesForbidden } from '../_shared'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * R100: `{root}` joins the hub → `{id, added}`. Callers: the app itself (same origin), or the `vibedoc` CLI on this
 * machine, which sends no Origin, so it must say `x-vibedoc-cli: 1` and talk to a localhost address.
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
  const { root } = await req.json().catch(() => ({}))
  try {
    const { project, added } = await addHubProject(root)
    if (added) emitUpdate('projects_updated', { id: project.id })
    return NextResponse.json({ id: project.id, added })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
