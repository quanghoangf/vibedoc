/**
 * src/lib/claude-cli.ts (R081)
 * Runs the Claude Code CLI for the Connect panel: fixed argv, no shell, in the project folder.
 * Process only (no fs): `claude mcp add` with the default local scope keys the server to the cwd's project.
 */
import { execFile } from 'child_process'

/** A `claude` call that hangs (a prompt, a network wait) is cut off after this. */
const CLI_TIMEOUT_MS = 30_000

export interface CliResult {
  ok: boolean
  code: number
  stdout: string
  stderr: string
  /** `claude` is not on PATH */
  missing: boolean
}

// ponytail: no shell, so a Windows `claude.cmd` shim isn't found; the panel's copy-the-command fallback covers it
function run(args: string[], cwd: string): Promise<CliResult> {
  return new Promise(resolve => {
    execFile('claude', args, { cwd, timeout: CLI_TIMEOUT_MS, env: process.env }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { code?: string | number; killed?: boolean }) | null
      const missing = e?.code === 'ENOENT'
      const code = !e ? 0 : typeof e.code === 'number' ? e.code : 1
      const timedOut = e?.killed ? `claude ${args.join(' ')} timed out after ${CLI_TIMEOUT_MS / 1000}s\n` : ''
      resolve({ ok: !e, code, stdout: String(stdout ?? ''), stderr: timedOut + String(stderr ?? '') || (e && !missing ? e.message : ''), missing })
    })
  })
}

export const mcpAddArgs = (url: string) => ['mcp', 'add', '--transport', 'http', 'vibedoc', url]
export const mcpRemoveArgs = ['mcp', 'remove', 'vibedoc', '-s', 'local']

export const mcpAdd = (root: string, url: string) => run(mcpAddArgs(url), root)
export const mcpRemove = (root: string) => run(mcpRemoveArgs, root)

/** Parsed `--json` output, or null with the reason (missing CLI, a failed call, output that isn't JSON). */
async function json(args: string[], cwd: string): Promise<{ data: unknown; error: CliResult | null }> {
  const r = await run(args, cwd)
  if (!r.ok) return { data: null, error: r }
  try {
    return { data: JSON.parse(r.stdout), error: null }
  } catch {
    return { data: null, error: { ...r, ok: false, stderr: `claude ${args.join(' ')} did not print JSON:\n${r.stdout.slice(0, 500)}` } }
  }
}

export const pluginList = (root: string) => json(['plugin', 'list', '--json'], root)
export const marketplaceList = (root: string) => json(['plugin', 'marketplace', 'list', '--json'], root)
export const marketplaceAdd = (root: string, source: string) => run(['plugin', 'marketplace', 'add', source], root)
export const pluginInstall = (root: string, plugin: string) => run(['plugin', 'install', plugin], root)

// R104 (ADR-006): one user-scope server for every project. No shell, so `${PWD}` is stored as written and Claude Code
// expands it per session; the cwd doesn't matter for user scope.
export const mcpAddUserArgs = (url: string) => ['mcp', 'add', '--scope', 'user', '--transport', 'http', 'vibedoc', url, '--header', 'X-VibeDoc-Root: ${PWD}']
export const mcpRemoveUserArgs = ['mcp', 'remove', 'vibedoc', '-s', 'user']
export const mcpAddUser = (cwd: string, url: string) => run(mcpAddUserArgs(url), cwd)
export const mcpRemoveUser = (cwd: string) => run(mcpRemoveUserArgs, cwd)

/** R113 T588: the `--permission-mode` choices `claude --help` lists, or null when the help doesn't say (an old CLI). Pure. */
export function permissionModeChoices(help: string): string[] | null {
  const block = help.match(/--permission-mode[\s\S]*?\(choices:([^)]*)\)/)
  return block ? [...block[1].matchAll(/"([A-Za-z]+)"/g)].map(m => m[1]) : null
}

/**
 * R113 T588: the `--permission-mode` choices of the installed CLI (`claude --help`), null when it doesn't say or isn't
 * there. Asked once per process: the CLI is the same until VibeDoc restarts.
 */
// ponytail: cached for the process's life; a Claude Code upgrade is seen after a VibeDoc restart
let modes: Promise<string[] | null> | null = null
export function claudePermissionModes(cwd: string): Promise<string[] | null> {
  modes ??= run(['--help'], cwd).then(r => (r.ok ? permissionModeChoices(r.stdout) : null))
  return modes
}
