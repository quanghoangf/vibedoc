/**
 * src/lib/worker-state.ts (R108 T557)
 * What a worker's stream says about it. Pure: the server folds a task turn's lines into the saved chat, the chat page
 * folds the same lines live.
 */

/** A tool call Claude Code refused: a deny rule (`git push`) or a command not on the allowlist. */
export interface RefusedCall { tool: string; input: string }

type Block = { type?: string; id?: string; name?: string; input?: unknown }

const inputText = (input: unknown): string => {
  const o = (input ?? {}) as Record<string, unknown>
  return typeof o.command === 'string' ? o.command : typeof o.file_path === 'string' ? o.file_path : JSON.stringify(input ?? {})
}

/**
 * Refusals in one turn's `stream-json` lines (ADR-007 § Spike): a `system` `permission_denied` event (its input comes
 * from the matching `tool_use`) and `result.permission_denials`. One row per `tool_use_id`, in order.
 */
export function refusedCalls(lines: (string | unknown)[]): RefusedCall[] {
  const inputs = new Map<string, { tool: string; input: string }>()
  const refused = new Map<string, RefusedCall>()
  for (const line of lines) {
    let ev: Record<string, unknown> | null = null
    if (typeof line === 'string') { try { ev = JSON.parse(line) } catch { continue } } else ev = line as Record<string, unknown>
    if (!ev || typeof ev !== 'object') continue
    if (ev.type === 'assistant') {
      const content = ((ev.message as { content?: Block[] } | undefined)?.content ?? [])
      for (const b of content) if (b?.type === 'tool_use' && b.id) inputs.set(b.id, { tool: b.name ?? '', input: inputText(b.input) })
    } else if (ev.type === 'system' && ev.subtype === 'permission_denied') {
      const id = String(ev.tool_use_id ?? `#${refused.size}`)
      const seen = inputs.get(id)
      if (!refused.has(id)) refused.set(id, { tool: String(ev.tool_name ?? seen?.tool ?? ''), input: seen?.input ?? String(ev.message ?? '') })
    } else if (ev.type === 'result' && Array.isArray(ev.permission_denials)) {
      for (const d of ev.permission_denials as { tool_name?: string; tool_use_id?: string; tool_input?: unknown }[]) {
        const id = String(d?.tool_use_id ?? `#${refused.size}`)
        refused.set(id, { tool: String(d?.tool_name ?? ''), input: inputText(d?.tool_input) })
      }
    }
  }
  return [...refused.values()]
}

/** T567: one task's budget (`workers.maxTurnsPerTask`, `workers.taskTimeoutMin`). */
export interface TurnBudget { maxTurns: number; timeoutMin: number }

/** `rate_limit_event.rate_limit_info` (ADR-007 § Spike). `resetsAt` is epoch seconds. */
export interface RateLimitInfo { status?: string; resetsAt?: number; unifiedWindows?: Record<string, { utilization?: number } | undefined> }

/** How a task turn's process ended, before the loop reads the task's status. */
export type TurnOutcome =
  | { kind: 'done' }
  | { kind: 'over-turns' }
  | { kind: 'over-time' }
  | { kind: 'usage-limit'; retryAt: string | null }
  | { kind: 'error' }

type ResultEvent = { subtype?: string; terminal_reason?: string; is_error?: boolean; result?: unknown; errors?: unknown }

/** A limit message (the rejected shape was never observed, ADR-007: match by text) */
const LIMIT_TEXT = /usage limit|rate limit|limit reached|\b429\b/i

/** Pause before the next claim at or above this share of a usage window (spike: no rejected status was seen) */
export const USAGE_PAUSE_AT = 0.95

const resetIso = (resetsAt: number | undefined, nowMs: number): string | null =>
  typeof resetsAt === 'number' && resetsAt * 1000 > nowMs ? new Date(resetsAt * 1000).toISOString() : null

/**
 * How a turn ended (ADR-007 § Spike): `error_max_turns` (exit 1) = over its turn budget; killed by the timeout =
 * over time; a failure whose text names a limit, or a rate limit status other than allowed = a usage limit, retried
 * at the time the message gives (`…|<epoch>`, else `resetsAt`); a clean exit = done (the loop reads the task status).
 * `code: undefined` = unknown (T556: an adopted process): a result without `is_error` counts as a clean exit.
 */
export function turnOutcome(result: ResultEvent | null, exit: { code: number | null | undefined; stderr?: string; timedOut?: boolean }, elapsedMs: number, budget: TurnBudget, rateLimit?: RateLimitInfo | null, nowMs = Date.now()): TurnOutcome {
  // T556: a process adopted after a restart is not our child, so its exit code is unknown: judge by its result
  if (exit.code === undefined) exit = { ...exit, code: result && !result.is_error ? 0 : 1 }
  if (result?.subtype === 'error_max_turns' || result?.terminal_reason === 'max_turns') return { kind: 'over-turns' }
  if (exit.timedOut || (exit.code !== 0 && !result && elapsedMs >= budget.timeoutMin * 60_000)) return { kind: 'over-time' }
  if (exit.code === 0 && !result?.is_error) return { kind: 'done' }
  const text = [result?.result, ...(Array.isArray(result?.errors) ? result.errors : []), exit.stderr].filter(x => typeof x === 'string').join('\n')
  const rejected = rateLimit?.status !== undefined && !rateLimit.status.startsWith('allowed')
  if (LIMIT_TEXT.test(text) || rejected) {
    const epoch = /\|(\d{10})\b/.exec(text)?.[1]
    return { kind: 'usage-limit', retryAt: resetIso(epoch ? Number(epoch) : undefined, nowMs) ?? resetIso(rateLimit?.resetsAt, nowMs) }
  }
  return { kind: 'error' }
}

/** A finished turn whose usage window is nearly spent: pause until it resets before claiming the next task. */
export function rateLimitPause(info: RateLimitInfo | null | undefined, nowMs = Date.now()): string | null {
  if (!info) return null
  const used = Math.max(0, ...Object.values(info.unifiedWindows ?? {}).map(w => w?.utilization ?? 0))
  const rejected = info.status !== undefined && !info.status.startsWith('allowed')
  return rejected || used >= USAGE_PAUSE_AT ? resetIso(info.resetsAt, nowMs) : null
}

/** What one turn cost, from its `result` event (the numbers the spike read). */
export interface TurnUsage { turns: number; durationMs: number; costUsd: number; tokens: number }

export function turnUsage(result: Record<string, unknown> | null): TurnUsage | null {
  if (!result) return null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const u = (result.usage ?? {}) as Record<string, unknown>
  return {
    turns: num(result.num_turns),
    durationMs: num(result.duration_ms),
    costUsd: num(result.total_cost_usd),
    tokens: num(u.input_tokens) + num(u.output_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens),
  }
}

/** Sum of the turns' usage (the worker strip's total, or one task's turns). */
export function sumUsage(list: (TurnUsage | null | undefined)[]): TurnUsage {
  const total: TurnUsage = { turns: 0, durationMs: 0, costUsd: 0, tokens: 0 }
  for (const u of list) if (u) { total.turns += u.turns; total.durationMs += u.durationMs; total.costUsd += u.costUsd; total.tokens += u.tokens }
  return total
}

/** T556: GET /api/workers/stream names the turn it reads (its `startedAt`), so the page knows which one it followed. */
export const WORKER_TURN_HEADER = 'x-vibedoc-turn'

/** T556: the process of a worker's current task turn, saved next to its log (core `writeWorkerState`). */
export interface WorkerProcState {
  /** The worker's chat id */
  id: string
  pid: number
  taskId: string
  startedAt: string
  /** Where this turn starts in the worker's log (append-only, one file per worker) */
  offset: number
  /** From the turn's `system/init` line; a resume's is known up front */
  sessionId?: string | null
  /** Set when the server folded the turn into the chat: nothing left to adopt */
  endedAt?: string | null
}

/**
 * What a restart finds for a worker's last turn: `ended` = no process state, or the server already folded the turn;
 * `running` = the process is alive (follow its log); `between-tasks` = it exited on its own: its task is finished, or
 * it printed a result (e.g. it asked a question), so fold the log and let the loop decide; `interrupted` = it died
 * mid-task without a result (killed while VibeDoc was down): the worker waits for Resume.
 */
export type ProcPhase = 'running' | 'between-tasks' | 'interrupted' | 'ended'

const FINISHED_TASK = new Set(['done', 'review', 'cancelled'])

export function workerPhase(state: Pick<WorkerProcState, 'endedAt'> | null, alive: boolean, taskStatus: string | null, hasResult = false): ProcPhase {
  if (!state || state.endedAt) return 'ended'
  if (alive) return 'running'
  return hasResult || FINISHED_TASK.has(taskStatus ?? '') ? 'between-tasks' : 'interrupted'
}

/** The session id of a turn's log, from its `system/init` line (null before Claude Code printed it). */
export function sessionFromLog(lines: string[]): string | null {
  for (const line of lines) {
    try {
      const ev = JSON.parse(line)
      if (ev?.type === 'system' && ev.subtype === 'init' && typeof ev.session_id === 'string') return ev.session_id
    } catch {
      // stderr or a partial line
    }
  }
  return null
}
