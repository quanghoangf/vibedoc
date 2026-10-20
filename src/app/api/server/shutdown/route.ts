import { NextRequest, NextResponse } from 'next/server'
import { listChats, readHub, readWorkerStates } from '@/lib/core'
import { isDemo, isPlayground } from '@/lib/demo'
import { emitUpdate } from '@/lib/events'
import { stopAllStartedByUs } from '@/lib/frontend-server'
import { stopAllRuns } from '@/lib/test-runner'
import { isAlive, stopAllWorkers, type StoppedWorker } from '@/lib/worker-runs'
import type { Worker } from '@/lib/chats'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const isLocal = (url: string) => { try { return LOCAL_HOSTS.has(new URL(url).hostname) } catch { return false } }

/**
 * T571: `vibedoc stop` asks the server to stop what it started before the supervisor ends it: every agent worker's
 * turn (worker-runs; also turns of workers no loop adopted yet, from each hub project's state files), every test run
 * and every frontend dev server VibeDoc started. Only the CLI on this machine: header `x-vibedoc-cli: 1`, a localhost
 * address, no other origin. Replies `{ workers: [{id, epic}], testRuns, frontends }`; the server itself keeps running
 * until the supervisor stops it.
 */
export async function POST(req: NextRequest) {
  if (isDemo() || isPlayground()) return NextResponse.json({ error: 'Not available in the demo' }, { status: 403 })
  const origin = req.headers.get('origin')
  const allowed = req.headers.get('x-vibedoc-cli') === '1' && LOCAL_HOSTS.has(req.nextUrl.hostname)
    && req.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || isLocal(origin))
  if (!allowed) return NextResponse.json({ error: 'Only the vibedoc CLI on this machine can stop VibeDoc' }, { status: 403 })

  const orphans: (StoppedWorker & { pid: number })[] = []
  for (const { root } of (await readHub()).projects) {
    const states = (await readWorkerStates(root).catch(() => [])).filter(s => !s.endedAt && s.pid && isAlive(s.pid))
    if (!states.length) continue
    const chats = await listChats(root).catch(() => []) as { id: string; worker?: Worker }[]
    for (const s of states) {
      const epic = chats.find(c => c.id === s.id)?.worker?.target.id ?? s.taskId
      orphans.push({ id: s.id, epic, pid: s.pid })
    }
  }
  const [workers, testRuns, frontends] = [await stopAllWorkers(orphans), stopAllRuns(), stopAllStartedByUs()]
  emitUpdate('server_stopping', { workers, testRuns, frontends })
  return NextResponse.json({ workers, testRuns, frontends })
}
