# T564: Finish actions: Open PR and Merge
**Status:** 👀 Review
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T563
**Covers:** S6
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
From the finish panel the user pushes the branch and opens a PR, or merges it into the base, each after one confirm. The worker itself can never push.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- These run as the **user's** action from the server (execFile, no shell), never from the worker's argv.
- Open PR is the main path: `git push -u origin <branch>` then `gh pr create --fill --base <base> --head <branch>`; show the PR URL. No `gh` / not logged in → show the commands to run (like Connect agent's fallback, `src/lib/claude-cli.ts`).
- **Merge and the dirty checkout.** While workers run, the main checkout always has uncommitted VibeDoc files: the workers' MCP calls write `plans/tasks/*.md`, `plans/roadmap/*`, `memory/`, `.vibedoc/`, `.vibedoc-activity.json` there. A plain "checkout must be clean" rule would refuse every merge. So the rule is: on `<base>`, and no uncommitted change **outside** those paths (pure `blockingChanges(statusPorcelain)` in `src/lib/git-actions.ts`). git itself still refuses if the merge would overwrite a dirty file: then refuse with that file named and offer Open PR.
- Merge = `git merge --no-ff <branch>`; a conflict → `git merge --abort`, refuse, "open a PR". Never resolve conflicts.
- Global rule: no Claude attribution in PR bodies or commits VibeDoc writes.

## Scope
- [ ] `src/lib/git-actions.ts`: push, pr create, merge with abort; pure `blockingChanges` + self-check
- [ ] `POST /api/workers/pr {id}`, `POST /api/workers/merge {id}` (same-origin, not demo/playground), `emitUpdate`
- [ ] Buttons in `WorkerFinish` with confirm dialogs naming the exact commands
- [ ] After merge, offer Remove (T563)

**Out of scope:** auto-merge; reviewers or labels.

## Files
- `src/lib/git-actions.ts`, `src/lib/git-actions.check.mts` — new
- `src/app/api/workers/pr/route.ts`, `src/app/api/workers/merge/route.ts` — new
- `src/components/workers/WorkerFinish.tsx`, `src/i18n/workers.ts`
- `e2e/worker-finish.mjs` — merge cases (local bare remote for push; `gh` stubbed on PATH)

## Acceptance criteria
- [ ] Merge while `plans/tasks/*.md` are modified in the main checkout → merges (S6)
- [ ] An uncommitted `src/` file in the main checkout, or another branch checked out → refused with the reason, nothing changed
- [ ] A conflicting branch → refused, main `git status` is as before
- [ ] Open PR with the stubbed `gh` → shows the URL; without `gh` → shows the commands

## Verify
```bash
node src/lib/git-actions.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-finish.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S6 — WHEN a worker's run ends → THEN the user sees the branch diff and can open a PR, merge, or remove the worktree
- [ ] Open a finished worker's chat (/chat?id=…) → the finish panel shows Open PR and "Merge into <base>" next to Remove worktree
- [ ] Click Open PR → the dialog names `git push -u origin <branch>` and `gh pr create --fill --base <base> --head <branch>`; Push and open PR → a "Pull request" link appears in the panel header
- [ ] On a real GitHub repo, Open PR → the PR opens with the branch's commits and no Claude attribution
- [ ] With `gh auth logout` (or gh not installed), Open PR → the dialog shows the two commands with copy buttons and nothing is pushed
- [ ] Edit a file under src/ in the main checkout, then Merge → refused with the file named and an "Open a PR instead" button; git status unchanged
- [ ] With only plans/tasks/*.md modified, Merge → "Merged into <base>." shows, and the Remove dialog opens with "Also delete branch" ticked
### Regression risk
- [ ] Remove worktree on an unmerged worker still asks to discard uncommitted changes and warns before deleting the branch
