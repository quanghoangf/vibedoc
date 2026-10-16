// The repo a command runs in (R100): the nearest ancestor with `.git` (a folder, or a file in a worktree), so a
// monorepo root wins over its package folders. Plain JS: the bin ships unbuilt. Check: node bin/repo-root.check.mts
import { existsSync } from 'node:fs'
import path from 'node:path'

/** The repo root containing `cwd`, or null when there is no `.git` up to `/`. */
export function repoRoot(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, '.git'))) return dir
    if (path.dirname(dir) === dir) return null
  }
}
