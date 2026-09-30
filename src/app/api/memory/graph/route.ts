import { NextRequest, NextResponse } from 'next/server'
import { getMemoryGraph } from '@/lib/core'
import { normalizeEntryId } from '@/lib/entries'
import { neighbourhood } from '@/lib/memory-graph'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** The memory link graph (R053). `?entry=E012` → only that entry and its direct neighbours. */
export async function GET(req: NextRequest) {
  try {
    const graph = await getMemoryGraph(rootOf(req))
    const entry = req.nextUrl.searchParams.get('entry')
    if (entry === null) return NextResponse.json(graph)
    const id = normalizeEntryId(entry)
    if (!id) return NextResponse.json({ error: `Invalid entry id "${entry}"` }, { status: 400 })
    return NextResponse.json(neighbourhood(graph, id))
  } catch (e) {
    return errorResponse(e)
  }
}
