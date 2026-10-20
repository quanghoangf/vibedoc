/**
 * GET /api/workers/stream?id=<worker chat id> (R108 T556) → the worker's current or last task turn as NDJSON: its part
 * of the log file from its start, then new lines until the turn ends (the server folded it: the state's `endedAt`), the
 * next turn starts (read up to where it starts), or its process is gone with no loop following it. 404 when the worker
 * never ran a task.
 * Read from the file, not memory, so it works the same after a restart; workers never use chat-turns.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { readWorkerLog, readWorkerState, rootFrom } from '@/lib/core'
import { isDemo } from '@/lib/demo'
import { isAlive, liveWorkerIds } from '@/lib/worker-runs'
import { WORKER_TURN_HEADER } from '@/lib/worker-state'
import { adoptWorkers } from '../deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const POLL_MS = 250

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const first = await readWorkerState(root, id).catch(() => null)
  if (!first) return NextResponse.json({ error: 'No task turn for this worker' }, { status: 404 })
  if (!isDemo()) void adoptWorkers(root, req.nextUrl.origin).catch(e => console.warn(`[vibedoc] workers not adopted: ${(e as Error).message}`))
  const encoder = new TextEncoder()
  let closed = false
  const follow = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    let offset = first.offset ?? 0
    while (!closed) {
      const st = await readWorkerState(root, id).catch(() => null)
      if (!st) return
      // the next turn started: this one is over, read it up to there
      const next = st.startedAt !== first.startedAt
      const done = next || !!st.endedAt || (!isAlive(st.pid) && !liveWorkerIds(root).has(id))
      const { text, next: after } = await readWorkerLog(root, id, offset, next ? st.offset : Infinity).catch(() => ({ text: '', next: offset }))
      offset = after
      if (text && !closed) controller.enqueue(encoder.encode(text))
      if (done) return
      await new Promise(r => setTimeout(r, POLL_MS))
    }
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => { if (!closed) { closed = true; controller.close() } }
      // the browser went away (reload, tab closed): stop reading, the turn itself keeps running
      req.signal.addEventListener('abort', close)
      // not awaited: a start() that resolves only at the end holds the body back until then
      void follow(controller).finally(close)
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform', [WORKER_TURN_HEADER]: first.startedAt } })
}
