import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { detectFrontend, detectPlaywright, frontendAuthStatus, readFrontendOverride, rootFrom, saveFrontendOverride } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { frontendNotes, loginUnavailable } from '@/lib/frontend'
import { loginRunning } from '@/lib/frontend-server'
import { isDemo, demoForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'

async function current(root: string) {
  const [app, override] = await Promise.all([detectFrontend(root), readFrontendOverride(root)])
  const vibedocPort = Number(process.env.PORT) || 3000
  const notes = app ? frontendNotes(app, vibedocPort, path.resolve(root) === process.cwd()) : []
  const [playwright, auth] = await Promise.all([app ? detectPlaywright(root, app) : null, frontendAuthStatus(root)])
  // T143: Log in state; `unavailable` = why it can't open a browser here
  const login = {
    running: loginRunning(root),
    unavailable: loginUnavailable({ demo: isDemo(), platform: process.platform, display: process.env.DISPLAY, waylandDisplay: process.env.WAYLAND_DISPLAY }),
  }
  return { app, notes, override, playwright, auth, login }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(await current(rootFrom(req.nextUrl.searchParams.get('root'))))
}

// body: { override: { dir?, startCommand?, url?, loginPath? } | null } — null (or all fields empty) = reset to detected
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
  if (override && 'loginPath' in override && typeof override.loginPath === 'string' && override.loginPath.trim() && !override.loginPath.trim().startsWith('/')) {
    return NextResponse.json({ error: 'login path must start with /, e.g. /login' }, { status: 400 })
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
