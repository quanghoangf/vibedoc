# T559: Worker's own dev server and port for UI specs
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T554
**Covers:** S9

## Goal
A worker's UI specs run against the worktree's own app on its own port, so "done" proves the branch, never the user's running checkout.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- T554 made `vibedoc_get_frontend` answer "no frontend for a worktree yet" for worker calls (`x-vibedoc-worker`). This task gives the real answer: **Dir** = the app folder inside the worktree, **URL** = `http://localhost:<worker port>`, start command with that port.
- Frontend detection: `getFrontend`-style code in core + pure `src/lib/frontend.ts` (`detectFrontendApp`); `ensureFrontend` in `src/lib/frontend-server.ts:95` keys servers by root: key worker servers by worktree dir.
- The work skill reuses any URL that answers (`plugin/skills/work/SKILL.md:129`): with its own port, the user's app on 3000 is never hit.
- How the port reaches the app: the app's start command honours `PORT` for Next/Vite? Next yes, Vite needs `--port`. Check `childEnv(url)` in `frontend-server.ts` for what is already done for VibeDoc-started apps and reuse it.

## Scope
- [ ] Pure `workerPort(base, used)` (first free from a base, e.g. the project's frontend port + 100) in `src/lib/worktrees.ts`; self-check
- [ ] Port saved in the worker state (T556) and freed when the worktree is removed
- [ ] `vibedoc_get_frontend` for a worker: worktree Dir, worker URL, start command; the test kit is written into the worktree
- [ ] A worker's server stops when its run ends or the worktree is removed

**Out of scope:** databases or other services per worktree (the app's own config decides).

## Files
- `src/lib/worktrees.ts` (+ check), `src/lib/core.ts`, `src/lib/frontend-server.ts`
- `src/app/api/mcp/route.ts` — `vibedoc_get_frontend` worker branch
- `e2e/worker-frontend.mjs` — new (fixture app that prints its port)

## Acceptance criteria
- [ ] Worker call to `vibedoc_get_frontend` → Dir inside the worktree, a port ≠ the user's frontend port (S9)
- [ ] Two workers get two different ports
- [ ] The main project's `vibedoc_get_frontend` answer is unchanged

## Verify
```bash
node src/lib/worktrees.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-frontend.mjs
```

## Manual tests
- [ ] S9 — WHEN a worker runs a UI spec → THEN it hits the worktree's own app on its own port, not the user's running app
