/**
 * src/lib/worker-runs.ts (R108 T554)
 * Drives a worker (ADR-007 decision 1): claim the epic's next ready task, run `claude -p "/vibedoc:work <task>"` in a
 * fresh session with cwd = the worktree, repeat until the epic is finished or needs the user. Process handling only,
 * no fs: the route passes core calls in. State lives on globalThis (like test-runner.ts), one loop per worker.
 * Each task turn streams through chat-turns.ts under the worker's chat id, so the chat page follows it.
 * T558: a turn that asks (vibedoc_ask_questions) and exits with the task in-progress waits on the user; the answer
 * resumes that task's session (cwd = the worktree again) and the loop goes on.
 */
import { spawn, type ChildProcess } from 'child_process'
import type { Chat, Worker, WorkerTurn } from './chats'
import type { QueueResult } from './work-queue'
import { nextStep, resumableTurn } from './worker-loop'
import { beginTurn } from './chat-turns'
import { killGroup } from './test-runner'
import { stopFrontend } from './frontend-server'
import { workerPort } from './worktrees'
import { refusedCalls, type RefusedCall } from './worker-state'

/** The chat message shape ChatContext renders (one user line per task, then the agent's last reply). */
type QuestionSet = { id: string; questions: unknown[]; answers?: string[] }
type Message = { role: 'user' | 'assistant'; text: string; tools: string[]; proposals: unknown[]; plans: unknown[]; questions: QuestionSet[]; error?: string; refused?: RefusedCall[] }
export type WorkerChat = Chat<Message> & { worker: Worker }

export interface WorkerDeps {
  /** claimNextTask for the worker's epic, owned by `ai:worker-<id>` */
  claim: () => Promise<QueueResult>
  /** The task's status in the main checkout after a turn */
  taskStatus: (taskId: string) => Promise<string>
  /** The argv of one task turn (worker-args.ts); `resume` answers a question in that task's session */
  args: (taskId: string, resume?: { sessionId: string; message: string }) => string[]
  /** The whole env of a task turn (workerEnv in worker-args.ts, T557): nothing else of VibeDoc's env passes */
  env: Record<string, string>
  /** Persist the chat and tell the browser (worker_updated) */
  save: (chat: WorkerChat) => Promise<void>
}

type Run = { epic: string; child: ChildProcess | null; cancelled: boolean; port?: number }
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

/**
 * Holds the epic before the worktree exists, so two quick POSTs never both start. Null = reserved; else why not:
 * the epic has a worker, or the project already runs `max` workers (T557, `workers.maxRunning`).
 * `port`: a resumed worker keeps its own (T558).
 */
export function reserveWorker(root: string, id: string, epic: string, max = Infinity, port?: number): 'epic' | 'limit' | null {
  if (workerForEpic(root, epic)) return 'epic'
  const prefix = `${root}\u0000`
  if ([...runs.keys()].filter(k => k.startsWith(prefix)).length >= max) return 'limit'
  runs.set(keyOf(root, id), { epic: epic.toUpperCase(), child: null, cancelled: false, ...(port && { port }) })
  return null
}

/**
 * T559: the reserved worker's dev server port. Sync, so two POSTs that awaited `saved` side by side still get two ports:
 * `saved` = ports of the project's saved workers whose worktree exists, plus every running worker's (any project).
 */
// ponytail: an ended worker's port only counts in its own project; check every hub project's chats if two collide
export function claimWorkerPort(root: string, id: string, base: number, saved: number[]): number {
  const run = runs.get(keyOf(root, id))
  if (!run) throw new Error(`worker ${id} was not reserved`)
  const vibedoc = Number(process.env.PORT) || 3000
  run.port = workerPort(base, [...saved, vibedoc, ...[...runs.values()].flatMap(r => r.port ?? [])])
  return run.port
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

/** T558: what the user answers a waiting worker with; `questionId` + `answers` fill that question card. */
export interface WorkerAnswer { message: string; questionId?: string; answers?: string[] }

/** One task turn: resolves with its result (the task's status, `error` or `stopped`). */
function runTurn(root: string, chat: WorkerChat, run: Run, turn: WorkerTurn, deps: WorkerDeps, resume?: string): Promise<string> {
  return new Promise((resolve) => {
    const args = resume && turn.sessionId ? deps.args(turn.taskId, { sessionId: turn.sessionId, message: resume }) : deps.args(turn.taskId)
    // a resume too: cwd = the worktree is the only thing that keeps it out of the user's checkout (spike run D)
    const child = spawn('claude', args, {
      cwd: chat.worker.dir, env: deps.env as NodeJS.ProcessEnv /* Next types NODE_ENV as required; a worker gets none */, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    })
    run.child = child
    const stream = beginTurn(root, chat.id, child)
    let pending = ''
    let stderr = ''
    let reply = ''
    let failed = ''
    const questions: QuestionSet[] = []
    const events: unknown[] = [] // the ones refusedCalls reads
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stream.push(text)
      const lines = (pending + text).split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        try {
          const ev = JSON.parse(line)
          if (typeof ev?.session_id === 'string') turn.sessionId = ev.session_id
          if (ev?.type === 'result' && typeof ev.result === 'string') reply = ev.result
          if (ev?.type === 'assistant' || ev?.type === 'system' || ev?.type === 'result') events.push(ev)
          // T558: the card the chat draws (ChatContext keeps the same shape), saved so the inbox counts it with no tab open
          if (ev?.type === 'assistant') {
            for (const b of ev.message?.content ?? []) {
              if (b?.type === 'tool_use' && String(b.name).endsWith('vibedoc_ask_questions') && Array.isArray(b.input?.questions)) questions.push({ id: b.id, questions: b.input.questions })
            }
          } else if (ev?.type === 'user') {
            for (const b of ev.message?.content ?? []) {
              if (b?.type === 'tool_result' && b.is_error) questions.splice(0, questions.length, ...questions.filter(q => q.id !== b.tool_use_id))
            }
          }
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
      // T559: sweep what the task left in its group, e.g. the dev server it started for its spec
      killGroup(child)
      run.child = null
      if (failed || (code !== 0 && !run.cancelled)) stream.push(JSON.stringify({ type: 'error', message: failed || stderr.trim() || `claude exited with code ${code}` }) + '\n')
      stream.end()
      const result = run.cancelled ? 'stopped' : failed || code !== 0 ? 'error' : await deps.taskStatus(turn.taskId).catch(() => 'error')
      const refused = refusedCalls(events)
      chat.messages.push({ ...message('assistant', reply, result === 'error' ? (failed || stderr.trim() || `claude exited with code ${code}`) : undefined), questions, ...(refused.length && { refused }) })
      resolve(result)
    })
  })
}

/**
 * Runs the loop in the background; the caller reserved the epic. Never throws: a failure ends the worker.
 * `answer` (T558): first resume the waiting task's session with it (resumableTurn), then go on as usual.
 */
export function startWorker(root: string, chat: WorkerChat, deps: WorkerDeps, answer?: WorkerAnswer): void {
  const run = runs.get(keyOf(root, chat.id))
  if (!run) throw new Error(`worker ${chat.id} was not reserved`)
  const save = (patch: Partial<Worker>) => {
    chat.worker = { ...chat.worker, ...patch }
    chat.updatedAt = new Date().toISOString()
    chat.busy = chat.worker.phase === 'running'
    return deps.save(chat).catch(e => console.warn(`[vibedoc] worker ${chat.id} not saved: ${(e as Error).message}`))
  }
  // One turn: spawn first (synchronously, so the turn is registered before any await): the page follows it as soon as
  // `worker_updated` names it, and the answer route returns once it exists
  const runOne = async (turn: WorkerTurn, line: string, resume?: string) => {
    chat.messages.push(message('user', line))
    const ended = runTurn(root, chat, run, turn, deps, resume)
    await save({ phase: 'running', reason: undefined, turns: [...chat.worker.turns, turn] })
    turn.result = await ended
    turn.endedAt = new Date().toISOString()
    await save({}) // `turn` is in chat.worker.turns: its result and session are saved with it
    return turn
  }
  const fresh = (taskId: string, sessionId: string | null = null): WorkerTurn =>
    ({ taskId, sessionId, startedAt: new Date().toISOString(), endedAt: null, result: null })
  void (async () => {
    let last: WorkerTurn | null = null
    try {
      const waiting = answer && resumableTurn(chat.worker)
      if (answer && waiting) {
        if (answer.questionId && answer.answers) {
          for (const m of chat.messages) m.questions = m.questions.map(q => (q.id === answer.questionId ? { ...q, answers: answer.answers } : q))
        }
        last = await runOne(fresh(waiting.taskId, waiting.sessionId), answer.message, answer.message)
      }
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
        last = await runOne(fresh(step.taskId), `/vibedoc:work ${step.taskId}`)
      }
    } catch (e) {
      console.warn(`[vibedoc] worker ${chat.id} failed: ${(e as Error).message}`)
      await save({ phase: 'failed', reason: (e as Error).message })
    } finally {
      stopFrontend(chat.worker.dir) // a server VibeDoc started for this worktree (keyed by its dir) ends with the run
      runs.delete(keyOf(root, chat.id))
    }
  })()
}
