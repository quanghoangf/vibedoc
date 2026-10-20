# T563: Finish view: branch diff and Remove worktree
**Status:** 👀 Review
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T556
**Covers:** S6
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

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
_2026-10-20 — ai_
### Steps
- [ ] S6 — WHEN a worker's run ends → THEN the user sees the branch diff and can open a PR, merge, or remove the worktree
- [ ] Start a worker on an epic and let it finish → at the bottom of its chat a "What vibedoc/R… changed" panel lists its commits and changed files with +/- counts
- [ ] Click a file row in the panel → its diff opens or closes (short diffs start open, long ones collapsed)
- [ ] Click Remove worktree → a dialog says the folder can't be restored; Cancel leaves everything as it was
- [ ] Remove a worktree with uncommitted files → the dialog asks to discard them; "Discard and remove" removes it and the strip reads "Worktree removed"
- [ ] Tick "Also delete branch" before removing → `git branch` no longer lists the worker's branch; the chat is still in the list as history
### Regression risk
- [ ] A running worker chat still streams, shows task dividers and has no finish panel until it ends
- [ ] Your own checkout keeps its branch and files after a Remove
