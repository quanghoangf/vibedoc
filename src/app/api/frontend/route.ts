import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { detectFrontend, readFrontendOverride, rootFrom, saveFrontendOverride } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { frontendNotes } from '@/lib/frontend'
import { isDemo, demoForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'

async function current(root: string) {
  const [app, override] = await Promise.all([detectFrontend(root), readFrontendOverride(root)])
  const vibedocPort = Number(process.env.PORT) || 3000
  const notes = app ? frontendNotes(app, vibedocPort, path.resolve(root) === process.cwd()) : []
  return { app, notes, override }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(await current(rootFrom(req.nextUrl.searchParams.get('root'))))
}

// body: { override: { dir?, startCommand?, url? } | null } — null (or all fields empty) = reset to detected
export async function PUT(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  let body: { override?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const override = body?.override
  if (override != null && typeof override !== 'object') return NextResponse.json({ error: 'override must be an object or null' }, { status: 400 })
  if (override && 'url' in override && typeof override.url === 'string' && override.url.trim() && !URL.canParse(override.url.trim())) {
    return NextResponse.json({ error: 'url must be a full URL, e.g. http://localhost:5173' }, { status: 400 })
  }
  let saved
  try {
    saved = await saveFrontendOverride(override as Record<string, string> | null, root)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  emitUpdate('frontend_updated', { override: saved })
  return NextResponse.json(await current(root))
}
