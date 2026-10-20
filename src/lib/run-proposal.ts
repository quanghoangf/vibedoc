/**
 * src/lib/run-proposal.ts (R108 T561)
 * The run card's content (ADR-007 decision 2: routing is deterministic). Pure: the caller builds the context from core
 * (listWorkers, listRoadmap, settings, branches) and the live runs (worker-runs.ts). The same answer feeds the epic
 * sheet's "Work with agent", POST /api/workers (re-checked on Accept) and MCP vibedoc_propose_run.
 */
import type { Attach, WorkerPhase } from './chats'

/** A saved worker whose worktree still exists; `running` = a live process in this server (not the saved phase). */
export interface WorkerInfo {
  id: string
  target: Attach
  branch: string
  base: string
  dir: string
  phase: WorkerPhase
  running: boolean
  currentTask: string | null
  lastReply: string
  /** Commits on its branch that its base lacks; null when git couldn't tell */
  ahead: number | null
  port?: number
  updatedAt: string
}

export interface RunContext {
  /** `tasks`: the epic's **Tasks:** ids (T560: a task's epic) */
  roadmap: { id: string; parent: string | null; status: string; tasks?: string[] }[]
  /** T560: every task's status and owner, for a task target */
  tasks?: { id: string; status: string; owner: string | null; dependsOn?: string[] }[]
  /** The main checkout's branch: a new worktree's default base (HEAD when detached or unknown) */
  currentBranch?: string
  workers: WorkerInfo[]
  branches: string[]
  maxRunning: number
  allowedTools: string[]
  denied: string[]
  /** Each task's budget (T567, workers.maxTurnsPerTask / taskTimeoutMin) */
  budget?: RunBudget
}

export interface RunBudget { maxTurns: number; timeoutMin: number }

export interface RunProposal {
  target: Attach
  mode: 'new' | 'existing'
  workerId?: string
  branch: string
  base: string
  allowedTools: string[]
  denied: string[]
  /** Each task's budget (T567); undefined shows "No limit yet" */
  budget?: RunBudget
  /** existing: the worker runs right now, so Accept is off */
  running?: boolean
  currentTask?: string | null
  /** A task target's dependencies that aren't done or in review: the worker may stop and wait on you */
  waitingOn?: { id: string; status: string }[]
}

export interface RunRequest { mode?: 'new' | 'existing'; workerId?: string; branch?: string; base?: string }

/** The epic's worker: the newest one (one per epic, ADR-007 decision 6; an older one only if a worktree was left behind). */
export function workerFor(epic: string, workers: WorkerInfo[]): WorkerInfo | null {
  const mine = workers.filter(w => w.target.kind === 'epic' && w.target.id === epic)
  return mine.sort((a, b) => (a.running === b.running ? b.updatedAt.localeCompare(a.updatedAt) : a.running ? -1 : 1))[0] ?? null
}

/** `vibedoc/R108`, or `vibedoc/R108-2`… when a removed worker left its branch behind (removeWorktree keeps it). */
export function freeBranch(epic: string, branches: string[]): string {
  const taken = new Set(branches)
  const base = `vibedoc/${epic}`
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

/** T560: the epic a task is listed in, else null (a loose task). An epic target is its own epic. */
export function epicOf(target: Attach, ctx: Pick<RunContext, 'roadmap'>): string | null {
  if (target.kind === 'epic') return target.id
  return ctx.roadmap.find(i => i.parent && i.tasks?.includes(target.id))?.id ?? null
}

/** A loose task's own worker (its target is the task). */
const taskWorker = (id: string, workers: WorkerInfo[]) =>
  workers.filter(w => w.target.kind === 'task' && w.target.id === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null

/**
 * What a run on `target` would do: send it to the epic's worker, else a new worktree. `want` overrides (MCP, Accept).
 * T560: a task inside an epic with a worker goes to that worker (it claims the task next); else a new worktree on
 * `vibedoc/T123` whose loop runs that task only.
 */
export function routeRun(target: Attach, ctx: RunContext, want: RunRequest = {}): RunProposal {
  const tools = { allowedTools: ctx.allowedTools, denied: ctx.denied, ...(ctx.budget && { budget: ctx.budget }) }
  const epic = epicOf(target, ctx)
  const existing = want.mode === 'new' ? null
    : want.workerId ? ctx.workers.find(w => w.id === want.workerId) ?? null
    : (epic && workerFor(epic, ctx.workers)) || (target.kind === 'task' ? taskWorker(target.id, ctx.workers) : null)
  if (want.mode !== 'new' && (want.mode === 'existing' || want.workerId || existing)) {
    return {
      target, mode: 'existing', workerId: existing?.id ?? want.workerId, branch: existing?.branch ?? '', base: existing?.base ?? '',
      ...tools, running: existing?.running ?? false, currentTask: existing?.currentTask ?? null,
    }
  }
  const task = target.kind === 'task' ? ctx.tasks?.find(t => t.id === target.id) : undefined
  const waitingOn = (task?.dependsOn ?? []).flatMap(d => {
    const dep = ctx.tasks?.find(t => t.id === d)
    return dep && dep.status !== 'done' && dep.status !== 'review' ? [{ id: d, status: dep.status }] : []
  })
  return {
    target, mode: 'new', branch: want.branch?.trim() || freeBranch(target.id, ctx.branches), base: want.base?.trim() || ctx.currentBranch || 'HEAD', ...tools,
    ...(waitingOn.length && { waitingOn }),
  }
}

/** Why a run can't go, as data: `code` + `vars` for the UI's own words (i18n), `text` for the agent and the API (English). */
export interface RunRefusal {
  code: 'not-found' | 'horizon' | 'nothing-left' | 'in-progress' | 'has-worker' | 'branch-required' | 'branch-exists' | 'base-required' | 'limit' | 'no-worker' | 'other-target' | 'worker-running'
  vars: Record<string, string | number>
  /** A worker chat the refusal points to (has-worker, worker-running) */
  workerId?: string
  text: string
}

/** Why the proposal can't run now; empty = Accept may go. Messages are for the user and the agent (English). */
export function validateRunProposal(p: RunProposal, ctx: RunContext): string[] {
  return runRefusals(p, ctx).map(r => r.text)
}

/** validateRunProposal as data (the run card translates `code`). */
export function runRefusals(p: RunProposal, ctx: RunContext): RunRefusal[] {
  const id = p.target.id
  const no = (code: RunRefusal['code'], text: string, vars: RunRefusal['vars'] = {}, workerId?: string): RunRefusal => ({ code, vars: { id, ...vars }, text, ...(workerId && { workerId }) })
  // the worker that owns this run's files: the epic's (one per epic, ADR-007 decision 6), or a loose task's own
  let owner = id
  if (p.target.kind === 'task') {
    const task = ctx.tasks?.find(t => t.id === id)
    if (!task) return [no('not-found', `Task ${id} not found`)]
    if (task.status === 'done' || task.status === 'cancelled' || task.status === 'review') return [no('nothing-left', `${id} is ${task.status}: nothing left for a worker`, { status: task.status })]
    const mine = p.mode === 'existing' && task.owner === `ai:worker-${p.workerId}`
    if (task.status === 'in-progress' && !mine) return [no('in-progress', `${id} is in progress${task.owner ? ` (${task.owner})` : ''}`, { owner: task.owner ?? '' })]
    owner = epicOf(p.target, ctx) ?? id
  } else {
    const epic = ctx.roadmap.find(i => i.id === id)
    if (!epic) return [no('not-found', `Epic ${id} not found`)]
    if (!epic.parent) return [no('horizon', `${id} is a horizon; pass an epic id`)]
    if (epic.status === 'done') return [no('nothing-left', `${id} is done: nothing left for a worker`, { status: 'done' })]
  }
  const errors: RunRefusal[] = []
  const running = ctx.workers.filter(w => w.running).length
  const overLimit = () => no('limit', `The limit of ${ctx.maxRunning} running workers is reached (Settings → Workers). Stop one, or wait.`, { max: ctx.maxRunning })
  if (p.mode === 'new') {
    const w = workerFor(owner, ctx.workers) ?? (p.target.kind === 'task' ? taskWorker(id, ctx.workers) : null)
    if (w) errors.push(no('has-worker', `${owner} already has worker ${w.id} on ${w.branch} (${w.running ? 'running' : w.phase}): send the run to it (mode "existing", workerId "${w.id}")`, { owner, branch: w.branch }, w.id))
    if (!p.branch.trim()) errors.push(no('branch-required', 'A branch name is required'))
    else if (ctx.branches.includes(p.branch.trim())) errors.push(no('branch-exists', `Branch ${p.branch.trim()} already exists`, { branch: p.branch.trim() }))
    if (!p.base.trim()) errors.push(no('base-required', 'A base is required'))
    if (running >= ctx.maxRunning) errors.push(overLimit())
    return errors
  }
  const w = ctx.workers.find(x => x.id === p.workerId)
  if (!w) return [no('no-worker', `No worker ${p.workerId ?? '(none given)'} with a worktree in this project`)]
  if (w.target.id !== owner) return [no('other-target', `Worker ${w.id} works on ${w.target.id}, not ${id}`, { other: w.target.id })]
  if (w.running) return [no('worker-running', `Worker ${w.id} is already running on ${w.target.id}${w.currentTask ? ` (${w.currentTask})` : ''}`, { task: w.currentTask ?? w.target.id }, w.id)]
  if (running >= ctx.maxRunning) errors.push(overLimit())
  return errors
}

/** One line per worker for vibedoc_list_workers. */
export function formatWorkers(workers: WorkerInfo[]): string {
  if (!workers.length) return 'No workers in this project. Start one with "Work with agent" on an epic (or propose it with vibedoc_propose_run).'
  return `## Workers (${workers.length})\n` + workers.map(w => [
    `- **${w.id}** · ${w.target.id} · \`${w.branch}\` ← ${w.base}`,
    w.running ? 'running' : w.phase === 'running' || w.phase === 'starting' ? `${w.phase} (no live process)` : w.phase,
    w.currentTask ? `on ${w.currentTask}` : null,
    w.ahead === null ? null : `${w.ahead} commit${w.ahead === 1 ? '' : 's'} ahead`,
    w.port ? `port ${w.port}` : null,
  ].filter(Boolean).join(' · ') + (w.lastReply ? `\n  last: ${w.lastReply}` : '')).join('\n')
}

/** vibedoc_propose_run's reply for a valid proposal. */
export function formatProposal(p: RunProposal): string {
  const what = p.mode === 'existing' ? `send ${p.target.id} to worker ${p.workerId} (\`${p.branch}\`)` : `a new worktree for ${p.target.id} on \`${p.branch}\` from ${p.base}`
  return `🃏 Proposed: ${what}. Allowed tools: ${p.allowedTools.join(', ')}. Denied: ${p.denied.join(', ')}. Budget: ${p.budget ? `${p.budget.maxTurns} turns · ${p.budget.timeoutMin} min per task` : 'no limit yet'}.\nNothing is created or started: the user accepts the run card.`
}
