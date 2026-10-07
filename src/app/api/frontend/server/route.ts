/**
 * GET  /api/frontend/server → the frontend app's dev server state (T142)
 * POST /api/frontend/server {action: "start" | "stop"}
 *
 * Start reuses a server already answering at the app URL ("reused"), else runs the start command and
 * waits until the URL responds. Stop only kills a server VibeDoc started.
 */

import { NextRequest, NextResponse } from 'next/server'
import { detectFrontend, frontendAppDir, readFrontendStartTimeoutSec, rootFrom } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { ensureFrontend, frontendServerStatus, stopFrontend } from '@/lib/frontend-server'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EVENT = 'frontend_server_updated'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const app = await detectFrontend(root)
  if (!app) return NextResponse.json({ error: 'No frontend app detected' }, { status: 404 })
  return NextResponse.json(await frontendServerStatus(root, app.url))
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  // Start runs a shell command: refuse cross-site requests. JSON content type forces a CORS preflight.
  const origin = req.headers.get('origin')
  let sameOrigin = req.headers.get('sec-fetch-site') !== 'cross-site'
  try { if (origin && new URL(origin).host !== req.nextUrl.host) sameOrigin = false } catch { sameOrigin = false }
  if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }
  const action = (await req.json().catch(() => null))?.action
  if (action !== 'start' && action !== 'stop') return NextResponse.json({ error: 'action must be "start" or "stop"' }, { status: 400 })

  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const app = await detectFrontend(root)
  if (!app) return NextResponse.json({ error: 'No frontend app detected' }, { status: 404 })

  if (action === 'stop') {
    if (!stopFrontend(root)) return NextResponse.json({ error: 'VibeDoc didn’t start this server, so it won’t stop it' }, { status: 409 })
    emitUpdate(EVENT, { state: 'stopped' })
    return NextResponse.json({ state: 'stopped', url: app.url, startedByUs: false })
  }

  const cwd = frontendAppDir(root, app)
  if (!cwd) return NextResponse.json({ error: `App dir ${app.dir} is outside the project` }, { status: 400 })
  const timeoutSec = await readFrontendStartTimeoutSec(root)
  const starting = ensureFrontend({
    root, cwd, url: app.url, startCommand: app.startCommand, timeoutSec,
    onChange: () => emitUpdate(EVENT, {}),
  })
  // Other tabs show "starting" while this request waits
  emitUpdate(EVENT, { state: 'starting' })
  try {
    const server = await starting
    emitUpdate(EVENT, { state: 'running' })
    return NextResponse.json({ state: 'running', url: server.url, startedByUs: server.startedByUs, reused: !server.startedByUs })
  } catch (e) {
    emitUpdate(EVENT, { state: 'stopped' })
    return NextResponse.json({ error: (e as Error).message, output: (e as { output?: string }).output ?? '' }, { status: 502 })
  }
}
