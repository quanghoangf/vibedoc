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
