/**
 * POST /api/frontend/smoke → smoke test (T144): make sure the app is up (reuse or start), open its first page
 *                            headless with the saved Log in session, screenshot it, stop the app if we started it
 * GET  /api/frontend/smoke → the last screenshot (image/png), 404 when there is none
 *
 * POST returns a SmokeResult: ok, finalUrl, status, durationMs, startedServer, screenshot, notes, error.
 */

import { NextRequest, NextResponse } from 'next/server'
import { detectFrontend, detectPlaywright, frontendAppDir, frontendAuthStatus, prepareFrontendSmoke, readFrontendSmokeShot, readFrontendStartTimeoutSec, rootFrom } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { smokeNotes, type SmokeResult } from '@/lib/frontend'
import { ensureFrontend, ownsServer, runSmoke } from '@/lib/frontend-server'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SERVER_EVENT = 'frontend_server_updated'

export async function GET(req: NextRequest) {
  const shot = await readFrontendSmokeShot(rootFrom(req.nextUrl.searchParams.get('root')))
  if (!shot) return NextResponse.json({ error: 'No smoke screenshot yet' }, { status: 404 })
  return new NextResponse(new Uint8Array(shot), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  // Starts the app and a browser: refuse cross-site requests. JSON content type forces a CORS preflight.
  const origin = req.headers.get('origin')
  let sameOrigin = req.headers.get('sec-fetch-site') !== 'cross-site'
  try { if (origin && new URL(origin).host !== req.nextUrl.host) sameOrigin = false } catch { sameOrigin = false }
  if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }

  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const app = await detectFrontend(root)
  if (!app) return NextResponse.json({ error: 'No frontend app detected' }, { status: 404 })
  const cwd = frontendAppDir(root, app)
  if (!cwd) return NextResponse.json({ error: `App dir ${app.dir} is outside the project` }, { status: 400 })
  if (!URL.canParse(app.url)) return NextResponse.json({ error: 'Set the app URL first' }, { status: 400 })
  const pw = await detectPlaywright(root, app)
  if (!pw.installed) {
    return NextResponse.json({ error: 'Playwright isn’t installed in the app: Install it first' }, { status: 409 })
  }
  if (pw.browsersInstalled === false) {
    return NextResponse.json({ error: 'Chromium isn’t installed for Playwright: Install it first' }, { status: 409 })
  }

  const t0 = Date.now()
  const result = (r: Omit<SmokeResult, 'durationMs'>): SmokeResult => ({ ...r, durationMs: Date.now() - t0 })
  // A server the user started from Settings stays up; only one started for this smoke is stopped
  const ownedBefore = ownsServer(root)
  let server
  try {
    server = await ensureFrontend({
      root, cwd, url: app.url, startCommand: app.startCommand, timeoutSec: await readFrontendStartTimeoutSec(root),
      onChange: () => emitUpdate(SERVER_EVENT, {}),
    })
  } catch (e) {
    emitUpdate(SERVER_EVENT, { state: 'stopped' })
    return NextResponse.json(result({ ok: false, startedServer: false, screenshot: false, notes: [], error: (e as Error).message }))
  }
  const startedServer = server.startedByUs && !ownedBefore
  if (startedServer) emitUpdate(SERVER_EVENT, { state: 'running' })

  const [{ shotPath, statePath }, auth] = await Promise.all([prepareFrontendSmoke(root), frontendAuthStatus(root)])
  let body: SmokeResult
  try {
    const { finalUrl, status } = await runSmoke({ cwd, url: app.url, outPath: shotPath, statePath: auth.saved ? statePath : null })
    body = result({
      ok: status == null || status < 400, finalUrl, status, startedServer, screenshot: true,
      notes: smokeNotes(finalUrl, app.loginPath, auth.saved),
    })
  } catch (e) {
    body = result({ ok: false, startedServer, screenshot: false, notes: [], error: (e as Error).message })
  } finally {
    if (startedServer) {
      server.stop()
      emitUpdate(SERVER_EVENT, { state: 'stopped' })
    }
  }
  emitUpdate('frontend_updated', { smoke: { ok: body.ok } })
  return NextResponse.json(body)
}
