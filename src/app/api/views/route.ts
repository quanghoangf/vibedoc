/**
 * /api/views
 * Saved board views (.vibedoc/views.json). GET falls back to the built-ins when the file is missing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredRoot, readViews, saveViews } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { DEFAULT_VIEWS, type SavedView, type ViewKind } from '@/lib/board-views'

export const dynamic = 'force-dynamic'

const MAX_VIEWS = 50
const ID_RE = /^[a-z0-9-]{1,40}$/
const KINDS: ViewKind[] = ['board', 'table', 'epic', 'timeline']

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  return NextResponse.json({ views: (await readViews(root)) ?? DEFAULT_VIEWS })
}

/** Returns an error message, or null when `views` is a valid SavedView[]. */
function invalid(views: unknown): string | null {
  if (!Array.isArray(views)) return 'views must be an array'
  if (views.length > MAX_VIEWS) return `at most ${MAX_VIEWS} views`
  const ids = new Set<string>()
  for (const v of views as Partial<SavedView>[]) {
    if (!v || typeof v !== 'object') return 'each view must be an object'
    if (typeof v.id !== 'string' || !ID_RE.test(v.id)) return `bad view id: ${String(v.id)}`
    if (ids.has(v.id)) return `duplicate view id: ${v.id}`
    ids.add(v.id)
    if (typeof v.name !== 'string' || v.name.length < 1 || v.name.length > 60) return `view ${v.id}: name must be 1–60 characters`
    if (!KINDS.includes(v.kind as ViewKind)) return `view ${v.id}: bad kind`
    if (!Array.isArray(v.filters) || !Array.isArray(v.sorts) || !Array.isArray(v.properties)) {
      return `view ${v.id}: filters, sorts and properties must be arrays`
    }
  }
  return null
}

// body: { views: SavedView[] } — replaces the whole list
export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  let body: { views?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const error = invalid(body?.views)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const views = body.views as SavedView[]
  try {
    await saveViews(views, root)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  emitUpdate('views_updated', { count: views.length })
  return NextResponse.json({ views })
}
