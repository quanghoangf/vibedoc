import { NextResponse, type NextRequest } from 'next/server'
import { isAllowedRoot, isMissingRoot, rootFrom } from '@/lib/core'

export function proxy(req: NextRequest) {
  // R099: a `?root=` must be the configured root or a hub project; every route reads it through rootFrom()
  const root = req.nextUrl.searchParams.get('root')
  // T545: /api/mcp answers an unknown folder itself, in words, so the agent stays connected
  if (root && !isAllowedRoot(root) && req.nextUrl.pathname !== '/api/mcp') return NextResponse.json({ error: 'not a VibeDoc project' }, { status: 403 })
  // T532: a hub project whose folder moved or was deleted fails cleanly, not with a 500 deep in a route (the demo resolves to its copy)
  if (root && isAllowedRoot(root) && isMissingRoot(rootFrom(root))) return NextResponse.json({ error: 'project folder not found' }, { status: 404 })
  if (req.nextUrl.pathname === '/docs') return docAsMarkdown(req)
  return NextResponse.next()
}

/** R087: the doc's page URL (`/docs?doc=<path>`) asked for `Accept: text/markdown` serves the doc itself (`/md/<path>`). */
function docAsMarkdown(req: NextRequest) {
  const doc = req.nextUrl.searchParams.get('doc')
  if (!doc || !req.headers.get('accept')?.includes('text/markdown')) return NextResponse.next()
  // `.` / `..` segments would be normalised out of /md/ by the URL parser: refuse here
  if (doc.split('/').some((s) => s === '.' || s === '..')) {
    return new NextResponse(`Refused: "${doc}" is not a project doc path\n`, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  const url = req.nextUrl.clone()
  url.pathname = `/md/${doc.split('/').map(encodeURIComponent).join('/')}`
  url.searchParams.delete('doc')
  return NextResponse.rewrite(url)
}

export const config = { matcher: '/((?!_next/static|_next/image|favicon.ico).*)' }
