# T563: Finish view: branch diff and Remove worktree
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T556
**Covers:** S6

## Goal
When a worker's run ends, the user reviews what its branch changed and can remove the worktree to free a slot.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- Diff = `git diff <base>...<branch>` (three dots: since the fork point) plus `git log --oneline base..branch`. Diff rendering: reuse `src/lib/diff.ts` / the `ProposalCard` diff look; a long diff collapses per file.
- Remove = `removeWorktree` (T553): refuses uncommitted changes unless the user confirms "discard"; option to delete the branch too (`git branch -D`, only when merged or confirmed). Also stops the worker's dev server (T559) and frees its port; the chat stays as history with "removed".
- Deletes don't confirm elsewhere in VibeDoc (undo toast), but a worktree can't be restored: this one confirms.

## Scope
- [ ] `GET /api/workers/diff?id=` → commits + per-file diff (capped, like verify context's 2000 lines)
- [ ] `POST /api/workers/remove {id, discard?, deleteBranch?}`
- [ ] `WorkerFinish` panel in the worker chat when the phase is ended: commits, files, diff, Remove
- [ ] Worker counts toward `maxRunning` only while running (check in T557's limit)

**Out of scope:** Open PR and Merge (T564).

## Files
- `src/app/api/workers/diff/route.ts`, `src/app/api/workers/remove/route.ts` — new
- `src/lib/core.ts` — `workerDiff()`
- `src/components/workers/WorkerFinish.tsx` — new; `src/i18n/workers.ts`
- `e2e/worker-finish.mjs` — new

## Acceptance criteria
- [ ] After the stub's run: the panel lists its commit and the file it changed (S6)
- [ ] Remove with a dirty worktree → asks to discard; after confirm the folder is gone and `git worktree list` no longer has it (S6)
- [ ] Main checkout unaffected by Remove (its branch, its files)

## Verify
```bash
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-finish.mjs
```

## Manual tests
- [ ] S6 — WHEN a worker's run ends → THEN the user sees the branch diff and can open a PR, merge, or remove the worktree
