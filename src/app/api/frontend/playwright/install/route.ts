/**
 * POST /api/frontend/playwright/install (T141)
 *
 * Adds @playwright/test to the frontend app and downloads Chromium, in the app dir.
 * Streams NDJSON like /api/chat: {type:"output", text} lines, then {type:"done", ok, code, tail}.
 * One install at a time (409). A failed package-manager step restores package.json.
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { detectFrontend, detectPlaywright, frontendAppDir, rootFrom, snapshotPackageJson } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { playwrightInstallSteps } from '@/lib/frontend'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TAIL_CHARS = 4000

// ponytail: one install per VibeDoc process, not per project; fine for a single local user
let installing = false

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  // This POST spawns installers: refuse cross-site requests. JSON content type forces a CORS preflight.
  const origin = req.headers.get('origin')
  let sameOrigin = req.headers.get('sec-fetch-site') !== 'cross-site'
  try { if (origin && new URL(origin).host !== req.nextUrl.host) sameOrigin = false } catch { sameOrigin = false }
  if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }
  if (installing) return NextResponse.json({ error: 'An install is already running' }, { status: 409 })
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  if (path.resolve(root) === process.cwd()) return NextResponse.json({ error: "Refusing to install into VibeDoc's own repo" }, { status: 400 })
  const app = await detectFrontend(root)
  if (!app) return NextResponse.json({ error: 'No frontend app detected' }, { status: 404 })
  const cwd = frontendAppDir(root, app)
  if (!cwd) return NextResponse.json({ error: `App dir ${app.dir} is outside the project` }, { status: 400 })
  const steps = playwrightInstallSteps(app.packageManager, await detectPlaywright(root, app))
  if (steps.length === 0) return NextResponse.json({ error: 'Playwright is already installed' }, { status: 409 })
  if (installing) return NextResponse.json({ error: 'An install is already running' }, { status: 409 })
  installing = true

  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream({
    // The browser went away: stop enqueueing (the abort listener kills the child)
    cancel() { closed = true },
    async start(controller) {
      let tail = ''
      const send = (obj: object) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')) }
      const out = (text: string) => { tail = (tail + text).slice(-TAIL_CHARS); send({ type: 'output', text }) }
      const run = (argv: string[]) => new Promise<number>(resolve => {
        out(`$ ${argv.join(' ')}\n`)
        // Fixed argv, no user input. A shell only on Windows, where npx/pnpm are .cmd shims. CI=1 keeps package managers from prompting.
        const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...process.env, CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
        const onAbort = () => child.kill('SIGTERM')
        req.signal.addEventListener('abort', onAbort)
        child.stdout.on('data', (c: Buffer) => out(c.toString('utf8')))
        child.stderr.on('data', (c: Buffer) => out(c.toString('utf8')))
        child.on('error', (e: NodeJS.ErrnoException) => out(`${e.code === 'ENOENT' ? `${argv[0]} not found on PATH` : e.message}\n`))
        child.on('close', code => { req.signal.removeEventListener('abort', onAbort); resolve(code ?? 1) })
      })

      let code = 0
      try {
        const restore = await snapshotPackageJson(cwd)
        for (const [i, argv] of steps.entries()) {
          code = await run(argv)
          if (code !== 0) {
            // Only the add step (first of two) touches package.json
            if (i === 0 && steps.length === 2) await restore()
            break
          }
        }
      } catch (e) {
        code = 1
        out(`${(e as Error).message}\n`)
      } finally {
        installing = false
        send({ type: 'done', ok: code === 0, code, tail })
        if (!closed) { closed = true; controller.close() }
        const playwright = await detectPlaywright(root, app).catch(() => null)
        emitUpdate('frontend_updated', { playwright })
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform' },
  })
}
