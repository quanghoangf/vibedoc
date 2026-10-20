/**
 * src/lib/worker-runs.ts (R108 T554)
 * Drives a worker (ADR-007 decision 1): claim the epic's next ready task, run `claude -p "/vibedoc:work <task>"` in a
 * fresh session with cwd = the worktree, repeat until the epic is finished or needs the user. Process handling only,
 * no fs: the route passes core calls in. State lives on globalThis (like test-runner.ts), one loop per worker.
 * Each task turn streams through chat-turns.ts under the worker's chat id, so the chat page follows it.
 */
import { spawn, type ChildProcess } from 'child_process'
import type { Chat, Worker, WorkerTurn } from './chats'
import type { QueueResult } from './work-queue'
import { nextStep } from './worker-loop'
import { beginTurn } from './chat-turns'
import { killGroup } from './test-runner'

/** The chat message shape ChatContext renders (one user line per task, then the agent's last reply). */
type Message = { role: 'user' | 'assistant'; text: string; tools: string[]; proposals: unknown[]; plans: unknown[]; questions: unknown[]; error?: string }
export type WorkerChat = Chat<Message> & { worker: Worker }

export interface WorkerDeps {
  /** claimNextTask for the worker's epic, owned by `ai:worker-<id>` */
  claim: () => Promise<QueueResult>
  /** The task's status in the main checkout after a turn */
  taskStatus: (taskId: string) => Promise<string>
  /** The argv of one task turn (worker-args.ts) */
  args: (taskId: string) => string[]
  /** Persist the chat and tell the browser (worker_updated) */
  save: (chat: WorkerChat) => Promise<void>
}

type Run = { epic: string; child: ChildProcess | null; cancelled: boolean }
const g = globalThis as unknown as { vibedocWorkers?: Map<string, Run>; vibedocWorkersExitHook?: boolean }
const runs = g.vibedocWorkers ?? (g.vibedocWorkers = new Map())

if (!g.vibedocWorkersExitHook) {
  g.vibedocWorkersExitHook = true
  process.once('exit', () => { for (const r of runs.values()) killGroup(r.child) })
}

const keyOf = (root: string, id: string) => `${root}\u0000${id}`
const message = (role: Message['role'], text: string, error?: string): Message =>
  ({ role, text, tools: [], proposals: [], plans: [], questions: [], ...(error ? { error } : {}) })

/** The running worker on this epic, if any (one worker per epic, ADR-007 decision 6). */
export function workerForEpic(root: string, epic: string): string | null {
  const prefix = `${root}\u0000`
  for (const [k, r] of runs) if (k.startsWith(prefix) && r.epic === epic.toUpperCase()) return k.slice(prefix.length)
  return null
}

/** Holds the epic before the worktree exists, so two quick POSTs never both start; false = taken. */
export function reserveWorker(root: string, id: string, epic: string): boolean {
  if (workerForEpic(root, epic)) return false
  runs.set(keyOf(root, id), { epic: epic.toUpperCase(), child: null, cancelled: false })
  return true
}

export function releaseWorker(root: string, id: string): void {
  runs.delete(keyOf(root, id))
}

/** Stop: kills the current task's process group. The task stays in-progress; no next task is claimed. */
export function cancelWorker(root: string, id: string): boolean {
  const run = runs.get(keyOf(root, id))
  if (!run) return false
  run.cancelled = true
  killGroup(run.child)
  return true
}

/** One task turn: resolves with its result (the task's status, `error` or `stopped`). */
function runTurn(root: string, chat: WorkerChat, run: Run, turn: WorkerTurn, deps: WorkerDeps): Promise<string> {
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY // the CLI falls back to the user's login, like the chat
  return new Promise((resolve) => {
    const child = spawn('claude', deps.args(turn.taskId), {
      cwd: chat.worker.dir, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    })
    run.child = child
    const stream = beginTurn(root, chat.id, child)
    let pending = ''
    let stderr = ''
    let reply = ''
    let failed = ''
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stream.push(text)
      const lines = (pending + text).split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        try {
          const ev = JSON.parse(line)
          if (!turn.sessionId && typeof ev?.session_id === 'string') turn.sessionId = ev.session_id
          if (ev?.type === 'result' && typeof ev.result === 'string') reply = ev.result
        } catch {
          // a partial or non-JSON line: the stream still has it
        }
      }
    })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.on('error', (e: NodeJS.ErrnoException) => {
      failed = e.code === 'ENOENT' ? 'Claude Code CLI not found on PATH. Install it and run `claude` once to log in.' : e.message
    })
    child.on('close', async (code) => {
      run.child = null
      if (failed || (code !== 0 && !run.cancelled)) stream.push(JSON.stringify({ type: 'error', message: failed || stderr.trim() || `claude exited with code ${code}` }) + '\n')
      stream.end()
      const result = run.cancelled ? 'stopped' : failed || code !== 0 ? 'error' : await deps.taskStatus(turn.taskId).catch(() => 'error')
      chat.messages.push(message('assistant', reply, result === 'error' ? (failed || stderr.trim() || `claude exited with code ${code}`) : undefined))
      resolve(result)
    })
  })
}

/** Runs the loop in the background; the caller reserved the epic. Never throws: a failure ends the worker. */
export function startWorker(root: string, chat: WorkerChat, deps: WorkerDeps): void {
  const run = runs.get(keyOf(root, chat.id))
  if (!run) throw new Error(`worker ${chat.id} was not reserved`)
  const save = (patch: Partial<Worker>) => {
    chat.worker = { ...chat.worker, ...patch }
    chat.updatedAt = new Date().toISOString()
    chat.busy = chat.worker.phase === 'running'
    return deps.save(chat).catch(e => console.warn(`[vibedoc] worker ${chat.id} not saved: ${(e as Error).message}`))
  }
  void (async () => {
    let last: WorkerTurn | null = null
    try {
      for (;;) {
        const phase = run.cancelled ? 'stopped' : chat.worker.phase
        let step = nextStep({ phase }, null, last)
        if (step.kind === 'claim') step = nextStep({ phase }, await deps.claim(), last)
        if (run.cancelled) step = nextStep({ phase: 'stopped' }, null, null)
        if (step.kind !== 'run-task') {
          const end = run.cancelled ? 'stopped' : step.kind === 'wait-user' ? 'wait-user' : 'ended'
          await save({ phase: end, reason: step.kind === 'claim' ? undefined : step.reason })
          return
        }
        const turn: WorkerTurn = { taskId: step.taskId, sessionId: null, startedAt: new Date().toISOString(), endedAt: null, result: null }
        chat.messages.push(message('user', `/vibedoc:work ${step.taskId}`))
        await save({ phase: 'running', turns: [...chat.worker.turns, turn] })
        turn.result = await runTurn(root, chat, run, turn, deps)
        turn.endedAt = new Date().toISOString()
        last = turn
        await save({}) // `turn` is in chat.worker.turns: its result and session are saved with it
      }
    } catch (e) {
      console.warn(`[vibedoc] worker ${chat.id} failed: ${(e as Error).message}`)
      await save({ phase: 'failed', reason: (e as Error).message })
    } finally {
      runs.delete(keyOf(root, chat.id))
    }
  })()
}
