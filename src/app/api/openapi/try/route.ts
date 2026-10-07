/**
 * POST /api/openapi/try {method, path, params?, query?, body?} → {status, statusText, elapsedMs, contentType, body, truncated, url}
 *
 * R094 Try it: sends one request for an endpoint of the project's OpenAPI spec to the project's own local app
 * (the spec's local server, else the frontend app, started if needed). Not a proxy: the client never names a host,
 * the method + path must be in the spec, and anything that isn't localhost is refused.
 */

import { NextRequest, NextResponse } from 'next/server'
import { detectFrontend, frontendAppDir, readFrontendStartTimeoutSec, readOpenApi, rootFrom } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { ensureFrontend } from '@/lib/frontend-server'
import { buildTryUrl, endpointDetail, tryTarget } from '@/lib/openapi'
import { refuseCrossSite } from '@/lib/same-origin'
import { demoForbidden, isDemo, isPlayground, playgroundForbidden } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIMEOUT_MS = 15_000
const MAX_BODY = 1024 * 1024

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const strings = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x ?? '')])) : {}

/** Response body as text, cut at MAX_BODY. */
async function readCapped(res: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = res.body?.getReader()
  if (!reader) return { text: '', truncated: false }
  const chunks: Uint8Array[] = []
  let size = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
    if (size > MAX_BODY) { truncated = true; await reader.cancel().catch(() => {}); break }
  }
  return { text: Buffer.concat(chunks).subarray(0, MAX_BODY).toString('utf8'), truncated }
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const input = await req.json().catch(() => null)
  if (!input || typeof input.method !== 'string' || typeof input.path !== 'string') return bad('method and path are required')

  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const file = await readOpenApi(root)
  if (!file) return bad('No OpenAPI spec found', 404)
  if ('error' in file) return bad(`${file.path}: ${file.error}`)
  const detail = endpointDetail(file.spec, input.method, input.path)
  if (!detail) return bad(`No endpoint ${input.method.toUpperCase()} ${input.path} in ${file.path}`, 404)

  const app = await detectFrontend(root)
  const target = tryTarget(file.spec, app?.url ?? null)
  if ('error' in target) return bad(target.error)
  const built = buildTryUrl(target.base, detail.path, strings(input.params), strings(input.query))
  if ('error' in built) return bad(built.error)

  if (target.start && app) {
    const cwd = frontendAppDir(root, app)
    if (!cwd) return bad(`App dir ${app.dir} is outside the project`)
    try {
      await ensureFrontend({
        root, cwd, url: app.url, startCommand: app.startCommand, timeoutSec: await readFrontendStartTimeoutSec(root),
        onChange: () => emitUpdate('frontend_server_updated', {}),
      })
    } catch (e) {
      return bad((e as Error).message, 502)
    }
    emitUpdate('frontend_server_updated', { state: 'running' })
  }

  const body = typeof input.body === 'string' && input.body.trim() && detail.method !== 'GET' && detail.method !== 'HEAD' ? input.body : undefined
  const contentType = detail.requestBody?.content[0]?.type ?? 'application/json'
  const started = Date.now()
  try {
    const res = await fetch(built.url, {
      method: detail.method,
      headers: body ? { 'content-type': contentType } : undefined,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const { text, truncated } = await readCapped(res)
    return NextResponse.json({
      url: built.url, status: res.status, statusText: res.statusText, elapsedMs: Date.now() - started,
      contentType: res.headers.get('content-type') ?? '', body: text, truncated,
    })
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } }
    const why = err.name === 'TimeoutError' ? `no answer within ${TIMEOUT_MS / 1000}s` : err.cause?.code ?? err.message
    return bad(`${detail.method} ${built.url} failed: ${why}`, 502)
  }
}
