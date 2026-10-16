/**
 * src/lib/git-clone.ts (R101 T537)
 * Runs `git clone` for All projects → Clone from git: fixed argv, no shell, `--` before the URL so it can't be an
 * option. Process only (no fs): core checks the URL and the folder, and removes a half-cloned folder on failure.
 * One clone at a time per server; its child lives on globalThis so Cancel (another request) can kill it.
 */
import { execFile, type ChildProcess } from 'child_process'

const CLONE_TIMEOUT_MS = 5 * 60_000

export interface CloneResult { ok: boolean; cancelled: boolean; error: string }

const g = globalThis as unknown as { vibedocClone?: { child: ChildProcess; cancelled: boolean } | null }

export const cloneRunning = (): boolean => !!g.vibedocClone

/** git's first error line ("fatal: repository '…' not found"; the later ones are generic "Could not read…"), in words. */
export function cloneErrorLine(stderr: string): string {
  const lines = stderr.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean)
  return lines.find(l => /^(fatal|error):/i.test(l)) ?? lines.pop() ?? ''
}

/** `onProgress` gets each progress line git prints ("Receiving objects:  42% …"). */
export function runClone(url: string, dest: string, onProgress: (line: string) => void): Promise<CloneResult> {
  return new Promise(resolve => {
    // GIT_TERMINAL_PROMPT=0: a repo that needs a password fails in words instead of hanging the server on a prompt
    const child = execFile('git', ['clone', '--progress', '--', url, dest],
      { timeout: CLONE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, _stdout, stderr) => {
        const entry = g.vibedocClone
        g.vibedocClone = null
        const cancelled = !!entry?.cancelled
        const e = err as (NodeJS.ErrnoException & { killed?: boolean }) | null
        const error = !e ? '' : e.code === 'ENOENT' ? 'git is not installed (not found on PATH)'
          : e.killed && !cancelled ? `git clone timed out after ${CLONE_TIMEOUT_MS / 60_000} minutes`
          : cloneErrorLine(String(stderr ?? '')) || e.message
        resolve({ ok: !e, cancelled, error })
      })
    g.vibedocClone = { child, cancelled: false }
    let last = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).pop()
      if (line && line !== last) onProgress(last = line)
    })
  })
}

/** Cancel: kills the running clone; false when none runs. */
export function cancelClone(): boolean {
  const entry = g.vibedocClone
  if (!entry) return false
  entry.cancelled = true
  entry.child.kill('SIGTERM')
  return true
}
