import { NextRequest, NextResponse } from 'next/server'
import { getDocGraph } from '@/lib/core'
import { docLinks } from '@/lib/doc-links'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** Links out of, into and broken in one .md file (R056): `?path=docs/x.md` → `{out, in, broken}`. */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams.get('path')
    if (!p) return NextResponse.json({ error: 'Missing "path"' }, { status: 400 })
    const links = docLinks(await getDocGraph(rootOf(req)), p)
    if (!links) return NextResponse.json({ error: `Unknown file "${p}"` }, { status: 404 })
    return NextResponse.json(links)
  } catch (e) {
    return errorResponse(e)
  }
}
