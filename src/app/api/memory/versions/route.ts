import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, getMemoryVersion, listMemoryVersions } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** Saved MEMORY.md versions (R045), newest first; `?id=` → { content } of one version. */
export async function GET(req: NextRequest) {
  try {
    const root = rootOf(req)
    const id = req.nextUrl.searchParams.get('id')
    if (id === null) return NextResponse.json(await listMemoryVersions(root))
    const content = await getMemoryVersion(id, root)
    if (content === null) throw new RoadmapError(`Version ${id} not found`, 404)
    return NextResponse.json({ content })
  } catch (e) {
    return errorResponse(e)
  }
}
