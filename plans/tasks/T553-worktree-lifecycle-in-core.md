# T553: Worktree lifecycle in core
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T552
**Covers:** S1

## Goal
VibeDoc can create, list and remove git worktrees for a project in one place outside the repo and install their dependencies, so a worker has somewhere isolated to work.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- Location: `<home>/worktrees/<project-slug>/<branch-slug>`. `<home>` today is computed inline in `hubFile()` (`src/lib/core.ts:266`): extract a `vibedocHome()` and use it in both.
- Branch names have `/` (`vibedoc/R108`): the folder is a slug, the branch keeps its name.
- Rule (CLAUDE.md): "`src/lib/core.ts` is the only place that touches the file system." git runs through `execFile` (no shell), as `getFileHistory` does.
- Rule (CLAUDE.md): the list of files VibeDoc writes outside the project must name this folder.

## Scope
- [ ] Pure `src/lib/worktrees.ts`: `branchSlug(branch)`, `worktreeDir(home, projectSlug, branch)`, `parseWorktreeList(porcelain)` (from `git worktree list --porcelain`), `ownWorktrees(list, home)` (only ours), `defaultBranch(target)` → `vibedoc/R108` / `vibedoc/T560`
- [ ] Self-check `src/lib/worktrees.check.mts`
- [ ] core: `vibedocHome()`, `createWorktree(root, {branch, base})` = `git -C <root> worktree add <dir> -b <branch> <base>`; refuses an existing branch or folder with a clear message
- [ ] core: `installWorktreeDeps(dir)` with the lockfile's package manager (`LOCKFILES` in `src/lib/frontend.ts`), output tail on failure
- [ ] core: `listWorktrees(root)`, `removeWorktree(root, dir, {force})` (refuses uncommitted changes unless `force`)
- [ ] CLAUDE.md: add `<home>/worktrees/` to the "Outside the project" list

**Out of scope:** spawning an agent (T554), any UI, deleting branches (T563).

## Files
- `src/lib/worktrees.ts`, `src/lib/worktrees.check.mts` — new
- `src/lib/core.ts` — `vibedocHome()`, worktree functions; `hubFile()` uses `vibedocHome()`
- `CLAUDE.md` — one clause

## Implementation notes
- `git worktree list --porcelain` blocks: `worktree <path>` / `HEAD <sha>` / `branch refs/heads/<name>` / `detached` / `locked`, separated by blank lines.
- Project slug: reuse what hub.json already keys a project by, if anything; else basename of root + short hash of the absolute root (two repos named `app`).
- pnpm shares its store, so an install in a worktree is cheap; npm is not, which is acceptable.
- Pure libs never import values from each other (`node *.check.mts` runs them unbundled).

## Acceptance criteria
- [ ] `createWorktree` on this repo makes `<home>/worktrees/<slug>/vibedoc-r108` on branch `vibedoc/R108`, and `git status` in the main checkout is unchanged (S1)
- [ ] A second create with the same branch → refused, nothing written
- [ ] `removeWorktree` with an uncommitted file → refused without `force`
- [ ] `listWorktrees` lists only worktrees under `<home>/worktrees/`
- [ ] Self-check covers slugging (`/`, spaces, case) and porcelain parsing (detached, locked)

## Verify
```bash
node src/lib/worktrees.check.mts
pnpm lint && pnpm build
```

## Manual tests
- [ ] S1 — WHEN the user accepts a run card for a new worktree → THEN a new worktree and branch exist, the worker's commits land only there, and the user's checkout has no code changes
