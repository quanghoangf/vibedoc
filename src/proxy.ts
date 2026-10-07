import { NextResponse, type NextRequest } from 'next/server'

/** R087: the doc's page URL (`/docs?doc=<path>`) asked for `Accept: text/markdown` serves the doc itself (`/md/<path>`). */
export function proxy(req: NextRequest) {
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

export const config = { matcher: '/docs' }
