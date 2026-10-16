import { NextRequest, NextResponse } from 'next/server'
import { discoverProjects, listProjectsWithCounts } from '@/lib/core'

/** The hub's projects (R099); `?counts=1` adds open / needs-you counts for All projects (T531). */
export async function GET(req: NextRequest) {
  const projects = req.nextUrl.searchParams.get('counts') === '1' ? await listProjectsWithCounts() : await discoverProjects()
  return NextResponse.json(projects)
}
