/**
 * src/lib/worker-args.ts (R108 T554)
 * The `claude -p` argv of one worker task turn (ADR-007 decisions 8–9 and § Spike). Pure: the route spawns it with
 * cwd = the worktree. Unlike the chat (/api/chat), a worker writes code: built-in tools, the project's settings and
 * VibeDoc's plugin. Each task starts a fresh session; `--resume` only answers a worker's question (T558), and the
 * caller must spawn it with cwd = the worktree again (spike run D: resume finds the session from any folder).
 */

/** Sent by a worker's `claude -p`: its tool calls are not the user's agent connecting (like the chat's header). */
export const WORKER_CALL_HEADER = 'x-vibedoc-worker'

/** Spike run B: only these built-ins, so no user hooks, plugins or extra tools leak into the worker. */
export const WORKER_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep'

/**
 * Read-only shell commands (R113 T588): in Accept edits mode a compound command (`pnpm lint | tail -5`) runs only when
 * every part matches a rule, so the usual tails and greps are allowed too.
 */
export const READ_ONLY_BASH = [
  'Bash(ls*)', 'Bash(cat *)', 'Bash(head *)', 'Bash(tail *)', 'Bash(wc *)', 'Bash(grep *)', 'Bash(rg *)', 'Bash(find *)',
  'Bash(echo *)', 'Bash(sort *)', 'Bash(diff *)', 'Bash(pwd)', 'Bash(which *)', 'Bash(sed -n *)',
  'Bash(git status*)', 'Bash(git diff*)', 'Bash(git log*)', 'Bash(git show*)', 'Bash(git branch*)', 'Bash(git rev-parse*)', 'Bash(git ls-files*)',
]
/** Running a project's checks: builds, tests, linters, scripts. */
const CHECK_BASH = ['Bash(pnpm *)', 'Bash(npm *)', 'Bash(yarn *)', 'Bash(bun *)', 'Bash(node *)', 'Bash(npx *)', 'Bash(tsc *)']

/** The default allowlist (`workers.allowedTools` in .vibedoc/settings.json replaces it, T557). */
export const WORKER_ALLOWED = [
  'mcp__vibedoc__*', 'Edit', 'Write', 'Read', 'Glob', 'Grep',
  'Bash(git add*)', 'Bash(git commit*)', 'Bash(mkdir *)', ...READ_ONLY_BASH, ...CHECK_BASH,
]
/** Always denied, whatever the settings say (ADR-007 decision 10): not a setting. */
export const WORKER_DENIED = ['Bash(git push*)', 'Bash(gh *)']

/** The only variables a worker inherits (spike: enough for the CLI, its login comes from the keychain). */
export const WORKER_BASE_ENV = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'TERM', 'TMPDIR']

/**
 * A worker's env (ADR-007 decision 10): the base names plus the names the user listed (`workers.env`), so tokens in
 * VibeDoc's own env (GITHUB_TOKEN, cloud keys, ANTHROPIC_API_KEY) never reach the agent unless listed.
 */
export function workerEnv(processEnv: Record<string, string | undefined>, extra: string[] = []): Record<string, string> {
  const env: Record<string, string> = {}
  for (const k of [...WORKER_BASE_ENV, ...extra]) if (processEnv[k] !== undefined) env[k] = processEnv[k] as string
  return env
}

/** The prompt: the skill in task mode, plus the rules a worktree needs (spike: the skill tried to stage the task file). */
export function workerPrompt(taskId: string): string {
  return `/vibedoc:work ${taskId}

You are a VibeDoc worker in a git worktree. Do task ${taskId} only, then stop: never call vibedoc_next_task.
Commit only the code and docs you changed here. VibeDoc owns plans/tasks/*, plans/roadmap/*, memory/MEMORY.md and .vibedoc*: never stage or edit them (the board lives in another checkout; use the vibedoc_* tools instead). Never push.`
}

/** T568: the review turn's prompt, the same words as R067's Verify button (`verifyTask` in ask-agent.ts). */
export const verifyPrompt = (taskId: string) => `Verify task ${taskId}: call vibedoc_verify_context, then vibedoc_report_findings.`

/**
 * T568: a review never edits: no Edit/Write tools. R113 T588: it may run the task's checks (its Verify block), so its
 * Bash covers the read-only commands and the check runners.
 */
export const VERIFY_TOOLS = 'Read,Glob,Grep,Bash'
export const VERIFY_ALLOWED = ['mcp__vibedoc__*', 'Read', 'Glob', 'Grep', ...READ_ONLY_BASH, ...CHECK_BASH]

/**
 * R113 T588: a worker's permission mode. `auto` (Claude Code's own classifier approves safe actions, the spike's
 * pick) or `acceptEdits` (edits pass, Bash only by the allowlist). `-p` has nobody to ask, so `default` would deny.
 */
export const WORKER_MODES = ['auto', 'acceptEdits'] as const
export type WorkerMode = (typeof WORKER_MODES)[number]
export const DEFAULT_WORKER_MODE: WorkerMode = 'auto'

/**
 * R113 T589: whose Claude Code setup a worker runs with. `mine`: the user's settings too (plugins, skills, hooks,
 * CLAUDE.md, permission rules) and the default tool set, like typing `claude` in the worktree. `isolated`: ADR-007's
 * spike setup (project settings, six tools), small and predictable. Spike 2026-10-21: a trivial turn's context was
 * 7.6k tokens isolated, 33.7k with the user's setup, 42.4k with their MCP servers as well.
 */
export const WORKER_SETUPS = ['mine', 'isolated'] as const
export type WorkerSetup = (typeof WORKER_SETUPS)[number]
export const DEFAULT_WORKER_SETUP: WorkerSetup = 'mine'

/** The mode a run uses: the wanted one when the CLI has it, else Accept edits (`fallback` says why). Pure. */
export function effectiveWorkerMode(wanted: WorkerMode, choices: string[] | null): { mode: WorkerMode; fallback: boolean } {
  if (wanted === 'auto' && !choices?.includes('auto')) return { mode: 'acceptEdits', fallback: true }
  return { mode: wanted, fallback: false }
}

/** T558: `-p` has no AskUserQuestion, so the worker asks through VibeDoc's card and waits on the user. */
export const WORKER_SYSTEM_PROMPT = 'To ask the user, call vibedoc_ask_questions and end your turn; the answer arrives as the next message. Never guess on a decision the task leaves open.'

export interface WorkerArgsInput {
  taskId: string
  /** The main checkout: task status lands where the board reads it (ADR-007 decision 8) */
  mainRoot: string
  /** The hub's origin, e.g. http://localhost:3333 */
  mcpOrigin: string
  workerId: string
  /** VibeDoc's own plugin/ folder */
  pluginDir: string
  /** The project's allowlist (`workers.allowedTools`); WORKER_DENIED is always appended as deny rules */
  allowed?: string[]
  /** T558: answer the worker's question in that task's session instead of starting a fresh one */
  resume?: { sessionId: string; message: string }
  /** T567: `workers.maxTurnsPerTask` (model round trips, not tool calls: ADR-007 § Spike) */
  maxTurns?: number
  /** T568: a fresh read-only review turn (verifyPrompt), not the task; ignores `allowed` and `resume` */
  verify?: boolean
  /** R113 T588: every turn's `--permission-mode` (task, fix, answer and review alike) */
  permissionMode?: WorkerMode
  /** R113 T589: the user's setup or the isolated one (a review keeps its four read-only tools either way) */
  setup?: WorkerSetup
  /** R113 T589: with `mine`, the user's MCP servers too (claude.ai connectors such as mail included); else VibeDoc's only */
  userMcp?: boolean
}

export function workerArgs({ taskId, mainRoot, mcpOrigin, workerId, pluginDir, allowed = WORKER_ALLOWED, resume, maxTurns, verify, permissionMode = 'acceptEdits', setup = 'isolated', userMcp = false }: WorkerArgsInput): string[] {
  const mine = setup === 'mine'
  const url = `${mcpOrigin}/api/mcp?root=${encodeURIComponent(mainRoot)}`
  return [
    ...(verify ? ['-p', verifyPrompt(taskId)] : resume ? ['-p', resume.message, '--resume', resume.sessionId] : ['-p', workerPrompt(taskId)]),
    ...(verify ? [] : ['--append-system-prompt', WORKER_SYSTEM_PROMPT]),
    '--output-format', 'stream-json', '--verbose',
    '--permission-mode', permissionMode,
    ...(maxTurns ? ['--max-turns', String(maxTurns)] : []),
    '--mcp-config', JSON.stringify({ mcpServers: { vibedoc: { type: 'http', url, headers: { [WORKER_CALL_HEADER]: workerId } } } }),
    ...(mine && userMcp ? [] : ['--strict-mcp-config']),
    '--setting-sources', mine ? 'user,project,local' : 'project,local',
    // a review never edits, whoever's setup; a task with the user's setup has Claude Code's default tool set
    ...(verify ? ['--tools', VERIFY_TOOLS] : mine ? [] : ['--tools', WORKER_TOOLS]),
    ...(verify ? [] : ['--plugin-dir', pluginDir]),
    '--allowedTools', ...(verify ? VERIFY_ALLOWED : allowed),
    // T561: proposing runs is the orchestrator chat's (T562), never a worker's
    '--disallowedTools', ...WORKER_DENIED, 'mcp__vibedoc__vibedoc_propose_run',
  ]
}
