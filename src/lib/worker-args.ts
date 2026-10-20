/**
 * src/lib/worker-args.ts (R108 T554)
 * The `claude -p` argv of one worker task turn (ADR-007 decisions 8–9 and § Spike). Pure: the route spawns it with
 * cwd = the worktree. Unlike the chat (/api/chat), a worker writes code: built-in tools, the project's settings and
 * VibeDoc's plugin, never `--resume` (each task starts a fresh session).
 */

/** Sent by a worker's `claude -p`: its tool calls are not the user's agent connecting (like the chat's header). */
export const WORKER_CALL_HEADER = 'x-vibedoc-worker'

/** Spike run B: only these built-ins, so no user hooks, plugins or extra tools leak into the worker. */
export const WORKER_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep'

/** The default allowlist (`workers.allowedTools` in .vibedoc/settings.json replaces it, T557). */
export const WORKER_ALLOWED = [
  'mcp__vibedoc__*', 'Edit', 'Write', 'Read', 'Glob', 'Grep',
  'Bash(git add*)', 'Bash(git commit*)', 'Bash(git status*)', 'Bash(git diff*)', 'Bash(git log*)',
  'Bash(pnpm *)', 'Bash(npm *)', 'Bash(node *)', 'Bash(npx *)',
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
}

export function workerArgs({ taskId, mainRoot, mcpOrigin, workerId, pluginDir, allowed = WORKER_ALLOWED }: WorkerArgsInput): string[] {
  const url = `${mcpOrigin}/api/mcp?root=${encodeURIComponent(mainRoot)}`
  return [
    '-p', workerPrompt(taskId),
    '--output-format', 'stream-json', '--verbose',
    '--mcp-config', JSON.stringify({ mcpServers: { vibedoc: { type: 'http', url, headers: { [WORKER_CALL_HEADER]: workerId } } } }),
    '--strict-mcp-config',
    '--setting-sources', 'project,local',
    '--tools', WORKER_TOOLS,
    '--plugin-dir', pluginDir,
    '--allowedTools', ...allowed,
    '--disallowedTools', ...WORKER_DENIED,
  ]
}
