import { NextRequest, NextResponse } from 'next/server'
import { getDocGraph, listRoadmap, listTasks } from '@/lib/core'
import type { DocNode } from '@/lib/doc-links'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/**
 * The resolved link graph between every .md file (R056): `{nodes, edges, broken, stale}`. Task and epic nodes carry their
 * `status` (a task's custom status id, else its built-in; an epic's roadmap status, planned = todo) and `owner`.
 */
export async function GET(req: NextRequest) {
  try {
    const root = rootOf(req)
    const [graph, { tasks }, { items }] = await Promise.all([getDocGraph(root), listTasks(root), listRoadmap(root)])
    const meta = new Map<string, Pick<DocNode, 'status' | 'owner'>>([
      ...tasks.map((t) => [`task:${t.id}`, { status: t.customStatus ?? t.status, owner: t.owner }] as const),
      ...items.map((r) => [`epic:${r.id}`, { status: r.status === 'planned' ? 'todo' : r.status, owner: r.owner }] as const),
    ])
    // new objects: getDocGraph's nodes are shared with its in-process cache
    const nodes = graph.nodes.map((n) => { const m = meta.get(`${n.kind}:${n.id}`); return m ? { ...n, ...m } : n })
    return NextResponse.json({ ...graph, nodes })
  } catch (e) {
    return errorResponse(e)
  }
}
