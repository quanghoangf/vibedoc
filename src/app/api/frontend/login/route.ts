/**
 * POST   /api/frontend/login → open the app in a headed Chromium (T143); the user logs in and closes it,
 *                               Playwright saves the session to .vibedoc/auth/storage-state.json
 * DELETE /api/frontend/login → clear the saved session
 *
 * POST makes sure the app is up (reuse or start, like /api/frontend/server), then returns {started:true}
 * right away. The browser's exit emits `frontend_updated` so Settings shows "Session saved".
 */

import { NextRequest, NextResponse } from 'next/server'
import { clearFrontendAuth, detectFrontend, detectPlaywright, frontendAppDir, frontendAuthStatus, prepareFrontendAuth, readFrontendStartTimeoutSec, rootFrom } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { loginUnavailable, loginUrl } from '@/lib/frontend'
import { ensureFrontend, openLoginBrowser } from '@/lib/frontend-server'
import { isDemo, demoForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Both verbs change the project: refuse cross-site requests. JSON content type forces a CORS preflight. */
function refuse(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin')
  let sameOrigin = req.headers.get('sec-fetch-site') !== 'cross-site'
  try { if (origin && new URL(origin).host !== req.nextUrl.host) sameOrigin = false } catch { sameOrigin = false }
  if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }
  return null
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const refused = refuse(req)
  if (refused) return refused
  const unavailable = loginUnavailable({ demo: false, platform: process.platform, display: process.env.DISPLAY, waylandDisplay: process.env.WAYLAND_DISPLAY })
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 400 })

  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const app = await detectFrontend(root)
  if (!app) return NextResponse.json({ error: 'No frontend app detected' }, { status: 404 })
  const cwd = frontendAppDir(root, app)
  if (!cwd) return NextResponse.json({ error: `App dir ${app.dir} is outside the project` }, { status: 400 })
  const url = loginUrl(app)
  if (!url) return NextResponse.json({ error: 'Set the app URL first' }, { status: 400 })
  const pw = await detectPlaywright(root, app)
  if (!pw.installed) {
    return NextResponse.json({ error: 'Playwright isn’t installed in the app: Install it first' }, { status: 409 })
  }
  if (pw.browsersInstalled === false) {
    return NextResponse.json({ error: 'Chromium isn’t installed for Playwright: Install it first' }, { status: 409 })
  }

  try {
    await ensureFrontend({
      root, cwd, url: app.url, startCommand: app.startCommand, timeoutSec: await readFrontendStartTimeoutSec(root),
      onChange: () => emitUpdate('frontend_server_updated', {}),
    })
  } catch (e) {
    emitUpdate('frontend_server_updated', { state: 'stopped' })
    return NextResponse.json({ error: (e as Error).message, output: (e as { output?: string }).output ?? '' }, { status: 502 })
  }
  emitUpdate('frontend_server_updated', { state: 'running' })

  const statePath = await prepareFrontendAuth(root)
  const started = openLoginBrowser({
    root, cwd, url, statePath,
    onExit: async (error) => emitUpdate('frontend_updated', { auth: await frontendAuthStatus(root), loginError: error }),
  })
  if (!started) return NextResponse.json({ error: 'A login window is already open' }, { status: 409 })
  emitUpdate('frontend_updated', { login: 'started' })
  return NextResponse.json({ started: true, url })
}

export async function DELETE(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const refused = refuse(req)
  if (refused) return refused
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const cleared = await clearFrontendAuth(root)
  const auth = await frontendAuthStatus(root)
  emitUpdate('frontend_updated', { auth })
  return NextResponse.json({ cleared, auth })
}
