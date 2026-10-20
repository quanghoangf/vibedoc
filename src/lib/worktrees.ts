/**
 * src/lib/worktrees.ts (R108 T553)
 * Pure helpers for agent worktrees (ADR-007 decision 7): `<home>/worktrees/<project-slug>/<branch-slug>`, outside the
 * repo. The folder is a slug, the branch keeps its name (`vibedoc/R108` → `vibedoc-r108`). Core runs git; this parses.
 */
import path from 'node:path'
import { createHash } from 'node:crypto'

export interface Worktree {
  path: string
  head: string
  /** Short name (`vibedoc/R108`), null when detached or bare. */
  branch: string | null
  detached: boolean
  locked: boolean
  bare: boolean
}

const SLUG_MAX = 60

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, SLUG_MAX).replace(/-+$/, '')
}

/** `vibedoc/R108` → `vibedoc-r108`; spaces, slashes and case fold to one dash-separated lowercase name. */
export function branchSlug(branch: string): string {
  return slugify(branch) || 'branch'
}

/** Basename slug + a short hash of the absolute root, so two repos both named `app` get their own folder. */
export function projectSlug(root: string): string {
  const abs = path.resolve(root)
  const hash = createHash('sha1').update(abs).digest('hex').slice(0, 8)
  return `${slugify(path.basename(abs)) || 'project'}-${hash}`
}

export function worktreesRoot(home: string): string {
  return path.join(home, 'worktrees')
}

export function worktreeDir(home: string, project: string, branch: string): string {
  return path.join(worktreesRoot(home), project, branchSlug(branch))
}

/** The branch a new run gets: an epic `R108` → `vibedoc/R108`, a task `T560` → `vibedoc/T560`. */
export function defaultBranch(target: string): string {
  return `vibedoc/${target.trim()}`
}

/** `git worktree list --porcelain`: blocks of `worktree <path>` / `HEAD <sha>` / `branch refs/heads/<name>` / `detached` / `locked [reason]` / `bare`. */
export function parseWorktreeList(porcelain: string): Worktree[] {
  const out: Worktree[] = []
  for (const block of porcelain.split(/\r?\n\s*\r?\n/)) {
    let wt: Worktree | null = null
    for (const line of block.split(/\r?\n/)) {
      const sp = line.indexOf(' ')
      const key = sp < 0 ? line : line.slice(0, sp)
      const value = sp < 0 ? '' : line.slice(sp + 1)
      if (key === 'worktree') wt = { path: value, head: '', branch: null, detached: false, locked: false, bare: false }
      else if (!wt) continue
      else if (key === 'HEAD') wt.head = value
      else if (key === 'branch') wt.branch = value.replace(/^refs\/heads\//, '')
      else if (key === 'detached') wt.detached = true
      else if (key === 'locked') wt.locked = true
      else if (key === 'bare') wt.bare = true
    }
    if (wt) out.push(wt)
  }
  return out
}

/** Only the worktrees VibeDoc made: under `<home>/worktrees/`. Pass the home and its realpath (git may report either). */
export function ownWorktrees(list: Worktree[], home: string | string[]): Worktree[] {
  const roots = (Array.isArray(home) ? home : [home]).map(h => path.resolve(worktreesRoot(h)) + path.sep)
  return list.filter(w => roots.some(r => path.resolve(w.path).startsWith(r)))
}
