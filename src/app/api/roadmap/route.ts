import { NextRequest, NextResponse } from 'next/server'
import { detectRoadmapSource, listGroupRoadmap, listRoadmap } from '@/lib/core'
import { errorResponse, rootOf } from './_shared'

export async function GET(req: NextRequest) {
  // R102: `?group=<slug>` = every member repo's epics, each tagged with its project (read-only)
  const group = req.nextUrl.searchParams.get('group')
  if (group) {
    const data = await listGroupRoadmap(group)
    return data ? NextResponse.json(data) : NextResponse.json({ error: `no group "${group}"` }, { status: 404 })
  }
  try {
    const root = rootOf(req)
    const data = await listRoadmap(root)
    // empty roadmap: tell the UI where "Generate roadmap" would take its content from
    if (data.items.length === 0) return NextResponse.json({ ...data, generateSource: await detectRoadmapSource(root) })
    return NextResponse.json(data)
  } catch (e) {
    return errorResponse(e)
  }
}
