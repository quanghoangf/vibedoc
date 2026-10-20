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
  roadmap: { id: string; parent: string | null; status: string }[]
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

/** What a run on `target` would do: send it to the epic's worker, else a new worktree. `want` overrides (MCP, Accept). */
export function routeRun(target: Attach, ctx: RunContext, want: RunRequest = {}): RunProposal {
  const tools = { allowedTools: ctx.allowedTools, denied: ctx.denied, ...(ctx.budget && { budget: ctx.budget }) }
  const existing = want.mode === 'new' ? null
    : want.workerId ? ctx.workers.find(w => w.id === want.workerId) ?? null
    : workerFor(target.id, ctx.workers)
  if (want.mode !== 'new' && (want.mode === 'existing' || want.workerId || existing)) {
    return {
      target, mode: 'existing', workerId: existing?.id ?? want.workerId, branch: existing?.branch ?? '', base: existing?.base ?? '',
      ...tools, running: existing?.running ?? false, currentTask: existing?.currentTask ?? null,
    }
  }
  return { target, mode: 'new', branch: want.branch?.trim() || freeBranch(target.id, ctx.branches), base: want.base?.trim() || 'HEAD', ...tools }
}

/** Why the proposal can't run now; empty = Accept may go. Messages are for the user and the agent (English). */
export function validateRunProposal(p: RunProposal, ctx: RunContext): string[] {
  const id = p.target.id
  if (p.target.kind !== 'epic') return [`Only an epic gets a worker for now; ${id} is a ${p.target.kind}`]
  const epic = ctx.roadmap.find(i => i.id === id)
  if (!epic) return [`Epic ${id} not found`]
  if (!epic.parent) return [`${id} is a horizon; pass an epic id`]
  if (epic.status === 'done') return [`${id} is done: nothing left for a worker`]
  const errors: string[] = []
  const running = ctx.workers.filter(w => w.running).length
  const overLimit = `The limit of ${ctx.maxRunning} running workers is reached (Settings → Workers). Stop one, or wait.`
  if (p.mode === 'new') {
    const w = workerFor(id, ctx.workers)
    if (w) errors.push(`${id} already has worker ${w.id} on ${w.branch} (${w.running ? 'running' : w.phase}): send the run to it (mode "existing", workerId "${w.id}")`)
    if (!p.branch.trim()) errors.push('A branch name is required')
    else if (ctx.branches.includes(p.branch.trim())) errors.push(`Branch ${p.branch.trim()} already exists`)
    if (!p.base.trim()) errors.push('A base is required')
    if (running >= ctx.maxRunning) errors.push(overLimit)
    return errors
  }
  const w = ctx.workers.find(x => x.id === p.workerId)
  if (!w) return [`No worker ${p.workerId ?? '(none given)'} with a worktree in this project`]
  if (w.target.kind !== p.target.kind || w.target.id !== id) return [`Worker ${w.id} works on ${w.target.id}, not ${id}`]
  if (w.running) return [`Worker ${w.id} is already running on ${id}${w.currentTask ? ` (${w.currentTask})` : ''}`]
  if (running >= ctx.maxRunning) errors.push(overLimit)
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
