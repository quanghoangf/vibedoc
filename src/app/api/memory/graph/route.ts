import { NextRequest, NextResponse } from 'next/server'
import { getMemoryGraph, listRoadmap } from '@/lib/core'
import { normalizeEntryId } from '@/lib/entries'
import { neighbourhood } from '@/lib/memory-graph'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/**
 * The memory link graph (R053). `?entry=E012` → only that entry and its direct neighbours, epic nodes carrying
 * their roadmap `status` (planned = todo, as /api/docs/links) so Related draws the same StatusIcon as tasks.
 */
export async function GET(req: NextRequest) {
  try {
    const root = rootOf(req)
    const graph = await getMemoryGraph(root)
    const entry = req.nextUrl.searchParams.get('entry')
    if (entry === null) return NextResponse.json(graph)
    const id = normalizeEntryId(entry)
    if (!id) return NextResponse.json({ error: `Invalid entry id "${entry}"` }, { status: 400 })
    const near = neighbourhood(graph, id)
    if (!near.nodes.some((n) => n.kind === 'epic')) return NextResponse.json(near)
    const { items } = await listRoadmap(root)
    const epics = new Map(items.map((r) => [r.id, r.status === 'planned' ? 'todo' : r.status]))
    return NextResponse.json({
      ...near,
      nodes: near.nodes.map((n) => {
        const status = n.kind === 'epic' ? epics.get(n.id) : undefined
        return status ? { ...n, status } : n
      }),
    })
  } catch (e) {
    return errorResponse(e)
  }
}
