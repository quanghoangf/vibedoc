import { NextResponse } from 'next/server'
import { discoverProjects } from '@/lib/core'

export async function GET() {
  const projects = await discoverProjects()
  return NextResponse.json(projects)
}
