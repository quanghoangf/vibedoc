import { NextRequest, NextResponse } from 'next/server'
import { touchProject } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

/** R099: the browser opened a hub project; stamps its `lastOpened`. */
export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!(await touchProject(id))) return NextResponse.json({ error: 'unknown project' }, { status: 404 })
  emitUpdate('projects_updated', { id })
  return NextResponse.json({ ok: true })
}
