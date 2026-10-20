# T561: Run card from the server: routing, existing workers, MCP tools
**Status:** 👀 Review
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T555, T557
**Covers:** S7, S8
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
"Work with agent" shows a run card at once that the server computed from the project's workers: a new worktree, or the worker that already has this epic. The same routing is an MCP tool, so an agent (T562) proposes with the same card.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007 ("routing is deterministic")
- Pure `src/lib/run-proposal.ts`:
  - `routeRun(target, ctx)` → proposal `{ target, mode: "new" | "existing", workerId?, branch, base, allowedTools, budget }`; ctx = tasks, roadmap, workers, settings, branches
  - `validateRunProposal(input, ctx)` → errors: target unknown or done, `new` while the epic has a worker (name it), `existing` with an unknown worker, over `maxRunning`, branch taken
- `GET /api/workers/propose?kind=epic&id=R108` → `routeRun`; `POST /api/workers` re-validates on Accept (state may have changed).
- `existing` + Accept: the worker is idle / ended / waiting → it continues its loop on the epic (a new task claim, not a new worktree); running → the card says so and Accept is off.
- MCP: `vibedoc_list_workers {}` (id, target, branch, base, phase, current task, last reply line, commits ahead of base, port) and `vibedoc_propose_run {target, mode?, workerId?, branch?, base?}` (validates, returns the proposal; creates nothing). Pattern: `vibedoc_propose_plan` (`src/lib/mcp-tools.ts:514`). Only the orchestrator chat gets `propose_run` (T562); workers never do.

## Scope
- [ ] `src/lib/run-proposal.ts` + `run-proposal.check.mts` (every refusal)
- [ ] Core `listWorkers(root)` (worker chats + states + `git rev-list --count base..branch`)
- [ ] `GET /api/workers/propose`; `POST /api/workers` takes `mode: "existing"` + `workerId`
- [ ] The button fetches the proposal and opens `RunCard` with it (T555's client-side proposal goes)
- [ ] MCP tool definitions in `src/lib/mcp-tools.ts` + handlers; `pnpm --dir site test` (tool pages are generated from `TOOLS`)

**Out of scope:** the orchestrator chat (T562).

## Files
- `src/lib/run-proposal.ts`, `src/lib/run-proposal.check.mts` — new
- `src/app/api/workers/propose/route.ts` — new; `src/app/api/workers/route.ts`
- `src/lib/core.ts`, `src/lib/mcp-tools.ts`, `src/app/api/mcp/route.ts`
- `src/components/workers/RunCard.tsx`, `src/components/roadmap/*`
- `e2e/worker-run.mjs`

## Acceptance criteria
- [ ] Work with agent on an epic without a worker → a "new worktree" card shows in under a second, nothing exists until Accept (S8)
- [ ] Same on an epic with an idle worker → "send to worker vibedoc/R108"; Accept continues that worker, no new worktree (S7)
- [ ] `vibedoc_propose_run new` for an epic with a worker → refused, naming the worker (S7)
- [ ] `vibedoc_list_workers` shows phase, current task and commits ahead for a stub worker

## Verify
```bash
node src/lib/run-proposal.check.mts
pnpm lint && pnpm build && pnpm --dir site test
BASE=http://localhost:3081 node e2e/worker-run.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S8 — WHEN the user clicks "Work with agent" → THEN a run card shows at once, and nothing is created or started until the user accepts it
- [ ] S7 — WHEN the user starts work on an epic that already has a worker → THEN the run card proposes sending it to that worker, and no second worktree is made
- [ ] Open /roadmap, pick an epic with no worker, click Work with agent → the card says "New worktree", branch vibedoc/<epic>, base HEAD, the allowed tools and Denied chips; Cancel → `git worktree list` and `git branch` unchanged
- [ ] On an epic whose worker ended, click Work with agent → the card says "Send to worker vibedoc/<epic>…", branch/base are read-only, the button reads "Send to worker"; Accept → the worker's chat opens and claims the next ready task in the same folder
- [ ] While that worker runs, open its epic's card again → "This worker is running Tn now…" and Send to worker is disabled
- [ ] Remove a worker's worktree (branch kept), then Work with agent on that epic → a new worktree on vibedoc/<epic>-2
### Regression risk
- [ ] Starting a brand-new worker from the epic sheet still opens its chat and streams the first task (T555)
- [ ] The in-app agent chat still works (its --disallowedTools list grew by vibedoc_propose_run)
