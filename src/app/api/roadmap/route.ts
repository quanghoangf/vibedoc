import { NextRequest, NextResponse } from 'next/server'
import { detectRoadmapSource, listRoadmap } from '@/lib/core'
import { errorResponse, rootOf } from './_shared'

export async function GET(req: NextRequest) {
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
