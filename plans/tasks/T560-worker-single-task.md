# T560: Start a worker on a single task
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** S (~1 hr)
**Depends on:** T561
**Covers:** S1

## Goal
The user can start a worker on one task, not only a whole epic; the worker's loop runs that one task (plus its verify) and ends.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- The skill's task mode exists (T554); the loop already runs one task per session. A task target = a loop whose queue is that task only.
- Routing (`routeRun`, T561): a task inside an epic that has a worker → the card proposes that worker (it claims this task next). A loose task or an epic without a worker → new worktree on `vibedoc/T123`.

## Scope
- [ ] `routeRun` / `POST /api/workers` with `target: {kind: "task", id}`; the loop stops after that task
- [ ] "Work with agent" in the board task panel ⋯ and on the epic sheet's task rows

**Out of scope:** several hand-picked tasks.

## Files
- `src/lib/run-proposal.ts`, `src/lib/worker-loop.ts` (+ checks)
- `src/app/api/workers/route.ts`
- `src/components/board/…` task panel actions, `src/components/roadmap/…` task rows
- `e2e/worker-run.mjs` — task case

## Acceptance criteria
- [ ] Task panel → Work with agent → card for `vibedoc/T123` → Accept → one stub call naming `T123`, then the worker ends (S1)
- [ ] A task whose epic has an idle worker → the card proposes that worker

## Verify
```bash
node src/lib/run-proposal.check.mts && node src/lib/worker-loop.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-run.mjs
```

## Manual tests
- [ ] S1 — WHEN the user accepts a run card for a new worktree → THEN a new worktree and branch exist, the worker's commits land only there, and the user's checkout has no code changes
