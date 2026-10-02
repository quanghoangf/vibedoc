import { NextRequest, NextResponse } from 'next/server'
import { getDocGraph, listRoadmap } from '@/lib/core'
import { docLinks, type LinkRow } from '@/lib/doc-links'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/**
 * Links out of, into and broken in one .md file (R056): `?path=docs/x.md` → `{out, in, broken, stale, targets}`.
 * Epic rows carry their roadmap `status` (planned = todo, as on /graph), so the panel draws the same StatusIcon as tasks.
 */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams.get('path')
    if (!p) return NextResponse.json({ error: 'Missing "path"' }, { status: 400 })
    const root = rootOf(req)
    const [graph, { items }] = await Promise.all([getDocGraph(root), listRoadmap(root)])
    const links = docLinks(graph, p)
    if (!links) return NextResponse.json({ error: `Unknown file "${p}"` }, { status: 404 })
    const epics = new Map(items.map((r) => [r.file, r.status === 'planned' ? 'todo' : r.status]))
    const withStatus = (rows: LinkRow[]) => rows.map((r) => {
      const status = r.kind === 'epic' ? epics.get(r.path) : undefined
      return status ? { ...r, status } : r
    })
    return NextResponse.json({ ...links, out: withStatus(links.out), in: withStatus(links.in) })
  } catch (e) {
    return errorResponse(e)
  }
}
