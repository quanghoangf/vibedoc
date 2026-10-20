/**
 * src/lib/worker-runs.ts (R108 T554)
 * Drives a worker (ADR-007 decision 1): claim the epic's next ready task, run `claude -p "/vibedoc:work <task>"` in a
 * fresh session with cwd = the worktree, repeat until the epic is finished or needs the user. Process handling only,
 * no fs: the route passes core calls in. State lives on globalThis (like test-runner.ts), one loop per worker.
 * T556: each task turn's process is detached and writes into the worker's log file (core), so it outlives the server;
 * the page follows that file (GET /api/workers/stream), and a restart adopts the process (or finds it interrupted).
 * T558: a turn that asks (vibedoc_ask_questions) and exits with the task in-progress waits on the user; the answer
 * resumes that task's session (cwd = the worktree again) and the loop goes on.
 * T567: each turn has a budget (`--max-turns`, a timeout that kills the group): over it, the worker waits on the user,
 * whose answer resumes the session with the budget again. A usage limit pauses the worker (phase `paused`, `retryAt`
 * saved) and reruns the task after it; a paused worker stays in `runs`, so it counts toward `workers.maxRunning`.
 * T568: a task that ends done or review gets a fresh read-only review turn (R067); critical or major findings resume
 * the task's session once with them, then a second review; still there → the task is sent back, the worker waits.
 */
import { spawn, type ChildProcess } from 'child_process'
import type { Chat, Worker, WorkerTurn } from './chats'
import type { QueueResult } from './work-queue'
import type { Finding } from './verification'
import { nextStep, orchestratorNote, pauseStep, resumableTurn } from './worker-loop'
import { verifyPrompt } from './worker-args'
import { formatFindingsNote } from './verification'
import { stopFrontend } from './frontend-server'
import { workerPort } from './worktrees'
import { rateLimitPause, refusedCalls, turnOutcome, turnUsage, workerPhase, type RateLimitInfo, type RefusedCall, type TurnBudget, type TurnOutcome, type WorkerProcState } from './worker-state'

/** The chat message shape ChatContext renders (one user line per task, then the agent's last reply). */
type QuestionSet = { id: string; questions: unknown[]; answers?: string[] }
type Message = { role: 'user' | 'assistant'; text: string; tools: string[]; proposals: unknown[]; plans: unknown[]; questions: QuestionSet[]; error?: string; refused?: RefusedCall[] }
export type WorkerChat = Chat<Message> & { worker: Worker }

export interface WorkerDeps {
  /** claimNextTask for the worker's epic, owned by `ai:worker-<id>` */
  claim: () => Promise<QueueResult>
  /** The task's status in the main checkout after a turn */
  taskStatus: (taskId: string) => Promise<string>
  /** The argv of one task turn (worker-args.ts); `resume` answers a question in that task's session, `verify` = a review turn */
  args: (taskId: string, opts?: { resume?: { sessionId: string; message: string }; verify?: boolean }) => string[]
  /** The whole env of a task turn (workerEnv in worker-args.ts, T557): nothing else of VibeDoc's env passes */
  env: Record<string, string>
  /** Persist the chat and tell the browser (worker_updated) */
  save: (chat: WorkerChat) => Promise<void>
  /** T562: leave a note in the orchestrator chat (its next turn reads it); never starts a turn */
  notify?: (note: string) => Promise<void>
  /** T567: `workers.maxTurnsPerTask` (also in `args`) and `workers.taskTimeoutMin` */
  budget: TurnBudget
  /** T556: the turn's log file and process state (core openWorkerLog / readWorkerLog / writeWorkerState) */
  openLog: () => Promise<{ fd: number; offset: number; close: () => Promise<void> }>
  readLog: (offset: number) => Promise<{ text: string; next: number }>
  appendLog: (text: string) => Promise<void>
  writeState: (state: WorkerProcState) => Promise<void>
  /** T568: `workers.verify`: review each finished task before the next claim */
  verify: boolean
  /** T568: the task's critical and major findings from its saved `## Verification` (none = clean) */
  findings: (taskId: string) => Promise<Finding[]>
  /** T568: the normal send-back with the findings as its note (the task goes back to todo) */
  sendBack: (taskId: string, findings: Finding[]) => Promise<void>
}

/**
 * `wake`: ends a pause early (cancel). `pid`: the current turn's process, also when a restart adopted it (`child` null).
 * No exit hook kills them: a task's process outlives the server (T556), and the next server adopts it.
 */
type Run = { epic: string; child: ChildProcess | null; pid: number | null; cancelled: boolean; port?: number; wake?: () => void }
const g = globalThis as unknown as { vibedocWorkers?: Map<string, Run> }
const runs = g.vibedocWorkers ?? (g.vibedocWorkers = new Map())

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
  runs.set(keyOf(root, id), { epic: epic.toUpperCase(), child: null, pid: null, cancelled: false, ...(port && { port }) })
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

/** T561: ids of the workers with a live loop in this server, for one project (the run card's `running`). */
export function liveWorkerIds(root: string): Set<string> {
  const prefix = `${root}\u0000`
  return new Set([...runs.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length)))
}

/** Stop came for a reserved worker (e.g. during its dependency install, before its loop started). */
export function isCancelled(root: string, id: string): boolean {
  return !!runs.get(keyOf(root, id))?.cancelled
}

export function releaseWorker(root: string, id: string): void {
  runs.delete(keyOf(root, id))
}

/** Stop: kills the current task's process group. The task stays in-progress; no next task is claimed. */
export function cancelWorker(root: string, id: string): boolean {
  const run = runs.get(keyOf(root, id))
  if (!run) return false
  run.cancelled = true
  killPid(run.pid)
  run.wake?.()
  return true
}

/** T558: what the user answers a waiting worker with; `questionId` + `answers` fill that question card. */
export interface WorkerAnswer { message: string; questionId?: string; answers?: string[] }

const POLL_MS = 250

/** Signals a turn's process group (the turn's pid leads it: spawned detached). Gone already = nothing to do. */
function killPid(pid: number | null, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (!pid) return
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, signal)
  } catch {
    // already gone
  }
}

/** T556: whether a turn's process still runs (EPERM = it runs, as another user). */
// ponytail: a pid reused by another program after a reboot reads as alive; compare the process start time if that bites
export function isAlive(pid: number): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

type TurnExit = { code: number | null | undefined; failed?: string }
type TurnEnd = { result: string; pauseUntil: string | null }

/**
 * T556: one task turn's process, detached and unref'd so it outlives the server, its stdout + stderr into the
 * worker's log file (`stdio: ['ignore', fd, fd]`), its pid in the state file. `ended` is watchTurn's.
 */
async function spawnTurn(chat: WorkerChat, run: Run, turn: WorkerTurn, deps: WorkerDeps, resume?: string): Promise<{ ended: Promise<TurnEnd> }> {
  const args = turn.kind === 'verify' ? deps.args(turn.taskId, { verify: true })
    : resume && turn.sessionId ? deps.args(turn.taskId, { resume: { sessionId: turn.sessionId, message: resume } }) : deps.args(turn.taskId)
  const log = await deps.openLog()
  let child: ChildProcess
  try {
    // a resume too: cwd = the worktree is the only thing that keeps it out of the user's checkout (spike run D)
    child = spawn('claude', args, {
      cwd: chat.worker.dir, env: deps.env as NodeJS.ProcessEnv /* Next types NODE_ENV as required; a worker gets none */, detached: true, stdio: ['ignore', log.fd, log.fd],
    })
  } finally {
    await log.close() // the child has its own copy of the fd
  }
  const exited = new Promise<TurnExit>((resolve) => {
    child.once('exit', code => resolve({ code }))
    child.once('error', (e: NodeJS.ErrnoException) => resolve({
      code: null, failed: e.code === 'ENOENT' ? 'Claude Code CLI not found on PATH. Install it and run `claude` once to log in.' : e.message,
    }))
  })
  child.unref()
  run.child = child
  run.pid = child.pid ?? null
  const proc: WorkerProcState = { id: chat.id, pid: child.pid ?? 0, taskId: turn.taskId, startedAt: turn.startedAt, offset: log.offset, sessionId: turn.sessionId }
  if (child.pid) await deps.writeState(proc)
  return { ended: watchTurn(chat, run, turn, deps, proc, exited, false) }
}

/** An adopted process is not our child: poll until it is gone (its exit code stays unknown). */
function waitDead(pid: number): Promise<TurnExit> {
  return new Promise((resolve) => {
    const check = () => (isAlive(pid) ? setTimeout(check, POLL_MS * 2) : resolve({ code: undefined }))
    check()
  })
}

/**
 * Follows one task turn through its log file until the process is gone and the log is drained, then folds it into
 * the chat. The same for a turn this server spawned and one a restart adopted (T556), so the chat file gets the
 * reply with no tab open. Resolves with the result (the task's status, `error`, `stopped`, `interrupted`,
 * `over-turns`, `over-time` or `usage-limit`) and, for a finished one, when to pause before the next claim.
 */
async function watchTurn(chat: WorkerChat, run: Run, turn: WorkerTurn, deps: WorkerDeps, proc: WorkerProcState, exited: Promise<TurnExit>, adopted: boolean): Promise<TurnEnd> {
  let offset = proc.offset ?? 0
  let stderr = ''
  let reply = ''
  const questions: QuestionSet[] = []
  const events: unknown[] = [] // the ones refusedCalls reads
  let resultEvent: Record<string, unknown> | null = null
  let rateLimit: RateLimitInfo | null = null
  let reported = false // T568: the review called vibedoc_report_findings
  const started = Date.parse(proc.startedAt) || Date.now()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; killPid(proc.pid) }, Math.max(0, deps.budget.timeoutMin * 60_000 - (Date.now() - started)))
  const onLine = (line: string) => {
    let ev
    try {
      ev = JSON.parse(line)
    } catch {
      stderr += line + '\n' // stderr shares the log
      return
    }
    if (typeof ev?.session_id === 'string') turn.sessionId = ev.session_id
    if (ev?.type === 'result' && typeof ev.result === 'string') reply = ev.result
    if (ev?.type === 'result') resultEvent = ev
    if (ev?.type === 'rate_limit_event' && ev.rate_limit_info) rateLimit = ev.rate_limit_info
    if (ev?.type === 'assistant' || ev?.type === 'system' || ev?.type === 'result') events.push(ev)
    // T558: the card the chat draws (ChatContext keeps the same shape), saved so the inbox counts it with no tab open
    if (ev?.type === 'assistant') {
      for (const b of ev.message?.content ?? []) {
        if (b?.type === 'tool_use' && String(b.name).endsWith('vibedoc_ask_questions') && Array.isArray(b.input?.questions)) questions.push({ id: b.id, questions: b.input.questions })
        if (b?.type === 'tool_use' && String(b.name).endsWith('vibedoc_report_findings')) reported = true
      }
    } else if (ev?.type === 'user') {
      for (const b of ev.message?.content ?? []) {
        if (b?.type === 'tool_result' && b.is_error) questions.splice(0, questions.length, ...questions.filter(q => q.id !== b.tool_use_id))
      }
    }
  }
  const drain = async () => {
    const { text, next } = await deps.readLog(offset)
    offset = next
    for (const line of text.split('\n')) if (line) onLine(line)
  }
  let exit: TurnExit | null = null
  void exited.then((e) => { exit = e })
  while (!exit) {
    await drain().catch(e => console.warn(`[vibedoc] worker ${chat.id} log not read: ${(e as Error).message}`))
    if (!exit) await new Promise(r => setTimeout(r, POLL_MS))
  }
  await drain().catch(() => {})
  clearTimeout(timer)
  // T559: sweep what the task left in its group, e.g. the dev server it started for its spec
  killPid(proc.pid)
  run.child = null
  run.pid = null
  const { code, failed } = exit as TurnExit
  let outcome: TurnOutcome = failed ? { kind: 'error' as const } : turnOutcome(resultEvent, { code, stderr, timedOut }, Date.now() - started, deps.budget, rateLimit)
  let status: string | null = null
  let interrupted = false
  if (adopted && !resultEvent && !failed && !timedOut && !run.cancelled) {
    // died without a result while VibeDoc was down (or since): interrupted, unless its task got finished anyway.
    // A review or fix turn's task was finished before it started, so its status says nothing: always interrupted
    status = turn.kind ? null : await deps.taskStatus(turn.taskId).catch(() => null)
    interrupted = workerPhase(proc, false, status) === 'interrupted'
    if (interrupted) turn.note = 'Interrupted: the process ended without finishing'
    else outcome = { kind: 'done' }
  }
  const usage = turnUsage(resultEvent)
  if (usage) turn.usage = usage
  if (outcome.kind === 'over-turns') turn.note = `Turn budget reached (${deps.budget.maxTurns})`
  if (outcome.kind === 'over-time') turn.note = `Took longer than ${deps.budget.timeoutMin} min`
  if (outcome.kind === 'usage-limit' && outcome.retryAt) turn.retryAt = outcome.retryAt
  // ponytail: a review that ends without reporting would read an older `## Verification` as current, so it waits on the user
  const unreported = turn.kind === 'verify' && outcome.kind === 'done' && !interrupted && !reported && !run.cancelled
  if (unreported) turn.note = 'the review ended without reporting findings'
  const error = outcome.kind === 'done' && !interrupted && !unreported ? undefined : turn.note || failed || stderr.trim() || reply || `claude exited with code ${code}`
  // the page following the log shows the error too; written before endedAt, so the stream's last read has it
  if (error && !run.cancelled) await deps.appendLog(JSON.stringify({ type: 'error', message: error }) + '\n').catch(() => {})
  await deps.writeState({ ...proc, sessionId: turn.sessionId, endedAt: new Date().toISOString() }).catch(e => console.warn(`[vibedoc] worker ${chat.id} state not saved: ${(e as Error).message}`))
  const result = run.cancelled ? 'stopped' : interrupted ? 'interrupted' : outcome.kind !== 'done' ? outcome.kind : unreported ? 'error'
    : turn.kind === 'verify' ? await deps.findings(turn.taskId).then(f => (f.length ? 'findings' : 'clean'), () => 'error')
    : status ?? await deps.taskStatus(turn.taskId).catch(() => 'error')
  const refused = refusedCalls(events)
  chat.messages.push({ ...message('assistant', reply, run.cancelled ? undefined : error), questions, ...(refused.length && { refused }) })
  return { result, pauseUntil: outcome.kind === 'done' ? rateLimitPause(rateLimit) : null }
}

/**
 * Runs the loop in the background; the caller reserved the epic. Never throws: a failure ends the worker.
 * `answer` (T558): first resume the waiting task's session with it (resumableTurn), then go on as usual.
 * `adopt` (T556): after a restart, first follow the last turn's process (alive or already gone), then go on as usual.
 * Resolves once the first new turn's process and state file exist (or the loop paused or ended without one): the answer and
 * resume routes wait for it, so the page's GET /api/workers/stream reads that turn and not the one before.
 */
export function startWorker(root: string, chat: WorkerChat, deps: WorkerDeps, answer?: WorkerAnswer, adopt?: WorkerProcState): Promise<void> {
  const run = runs.get(keyOf(root, chat.id))
  if (!run) throw new Error(`worker ${chat.id} was not reserved`)
  let spawned = () => {}
  const firstTurn = new Promise<void>((resolve) => { spawned = resolve })
  const save = (patch: Partial<Worker>) => {
    const from = chat.worker.phase
    chat.worker = { ...chat.worker, ...patch }
    const note = patch.phase && patch.phase !== from ? orchestratorNote(chat.worker, patch.phase, chat.worker.reason) : null
    if (note) deps.notify?.(note).catch(e => console.warn(`[vibedoc] orchestrator note not saved: ${(e as Error).message}`))
    chat.updatedAt = new Date().toISOString()
    chat.busy = chat.worker.phase === 'running'
    return deps.save(chat).catch(e => console.warn(`[vibedoc] worker ${chat.id} not saved: ${(e as Error).message}`))
  }
  // One turn: spawn (and write its state file) first: the page follows its log as soon as `worker_updated` names it
  const runOne = async (turn: WorkerTurn, line: string, resume?: string) => {
    chat.messages.push(message('user', line))
    const { ended } = await spawnTurn(chat, run, turn, deps, resume)
    if (run.cancelled) killPid(run.pid) // Stop came while it spawned
    await save({ phase: 'running', reason: undefined, retryAt: undefined, turns: [...chat.worker.turns, turn] })
    spawned()
    return endOne(turn, await ended)
  }
  const endOne = async (turn: WorkerTurn, { result, pauseUntil }: TurnEnd) => {
    turn.result = result
    turn.endedAt = new Date().toISOString()
    // `turn` is in chat.worker.turns: its result and session are saved with it
    await save(pauseUntil ? { retryAt: pauseUntil } : {})
    return turn
  }
  // T567: a usage limit (or a nearly spent window) waits here; Stop wakes it
  const pause = async (until: string) => {
    await save({ phase: 'paused', retryAt: until, reason: `Usage limit: tries again at ${until}` })
    spawned() // nothing runs while it waits: callers waiting for the first turn go on
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.max(0, Date.parse(until) - Date.now()))
      run.wake = () => { clearTimeout(timer); resolve() }
    })
    run.wake = undefined
  }
  const fresh = (taskId: string, sessionId: string | null = null, kind?: WorkerTurn['kind']): WorkerTurn =>
    ({ taskId, sessionId, startedAt: new Date().toISOString(), endedAt: null, result: null, ...(kind && { kind }) })
  void (async () => {
    let last: WorkerTurn | null = null
    try {
      const adopted = adopt && chat.worker.turns[chat.worker.turns.length - 1]
      if (adopt && adopted && adopted.result === null) {
        run.pid = adopt.pid
        last = await endOne(adopted, await watchTurn(chat, run, adopted, deps, adopt, waitDead(adopt.pid), true))
      }
      const waiting = answer && resumableTurn(chat.worker)
      if (answer && waiting) {
        if (answer.questionId && answer.answers) {
          for (const m of chat.messages) m.questions = m.questions.map(q => (q.id === answer.questionId ? { ...q, answers: answer.answers } : q))
        }
        // T556: an interrupted review reruns fresh; an interrupted fix stays a fix (one per send-back)
        last = waiting.kind === 'verify' ? await runOne(fresh(waiting.taskId, null, 'verify'), verifyPrompt(waiting.taskId))
          : await runOne(fresh(waiting.taskId, waiting.sessionId, waiting.result === 'interrupted' ? waiting.kind : undefined), answer.message, answer.message)
      }
      for (;;) {
        const paused = !run.cancelled && pauseStep(chat.worker)
        if (paused) {
          await pause(paused.retryAt)
          if (!run.cancelled) {
            await save({ retryAt: undefined })
            // T568: a limited review or fix: the gate decides again from the turn before it (a review runs again)
            if (paused.taskId && paused.kind) last = chat.worker.turns[chat.worker.turns.length - 2] ?? null
            // the limit stopped this task mid-way: run it again in a fresh session (it is still in-progress and ours)
            else if (paused.taskId) { last = await runOne(fresh(paused.taskId), `/vibedoc:work ${paused.taskId}`); continue }
          }
        }
        const phase = run.cancelled ? 'stopped' : chat.worker.phase
        const gate = { verify: deps.verify, turns: chat.worker.turns }
        const { target } = chat.worker
        let step = nextStep({ phase, target }, null, last, gate)
        if (step.kind === 'claim') step = nextStep({ phase, target }, await deps.claim(), last, gate)
        if (run.cancelled) step = nextStep({ phase: 'stopped' }, null, null)
        if (step.kind === 'verify') { last = await runOne(fresh(step.taskId, null, 'verify'), verifyPrompt(step.taskId)); continue }
        if (step.kind === 'fix') {
          const note = formatFindingsNote(await deps.findings(step.taskId)) || `Fix the findings in ${step.taskId}'s ## Verification.`
          last = await runOne(fresh(step.taskId, step.sessionId, 'fix'), note, note)
          continue
        }
        if (step.kind === 'send-back') {
          const findings = await deps.findings(step.taskId)
          await deps.sendBack(step.taskId, findings)
          if (last) {
            last.result = 'sent-back'
            last.note = `sent back with ${findings.length} verification finding${findings.length === 1 ? '' : 's'} after one fix`
          }
          continue // the gate sees `sent-back`: wait on the user
        }
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
      spawned()
    }
  })()
  return firstTurn
}
