# T565: Agent runs: site docs, Done-when e2e, close the epic
**Status:** 👀 Review
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T566, T552, T553, T554, T555, T556, T557, T558, T559, T560, T561, T562, T563, T564, T567, T568
**Covers:** S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
Prove the epic's Done when end to end, document the feature for users, and hand off.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- Each earlier task landed its own tests and CLAUDE.md lines; this task only adds what spans them.
- Done when: "the user clicks Work with agent on an epic with ready tasks, accepts the run card, closes the tab, and later finds the tasks done and verified on the board and a branch with one commit per task ready to review, while their own checkout has no code changes."
- Site: Starlight pages under `site/src/content/docs/`; see `docs/concepts/visual-docs` for the shape. Include the limits from the breakdown discussion: no mid-turn permission prompts (allowlist decided up front), the allowlist is not a sandbox, the minimal env, budgets and usage-limit pauses, no interrupting a task except Cancel, the orchestrator chat is optional.
- Spec merge is the human's step (`**Spec merged:**`), not this task's.

## Scope
- [ ] `e2e/agent-runs.mjs`: fixture epic with two ready tasks, stub on PATH → Work with agent → run card → Accept → close the page → reopen later → both tasks done with a clean verification, branch has one commit per task, main checkout `git status` has no code change
- [ ] Site page `docs/concepts/agent-runs` (how it works, the limits, settings)
- [ ] MEMORY.md: a Key conventions line for R108 (files, libs, checks, e2e)
- [ ] Every task's manual-test S-steps ticked or listed for the human; epic status done

**Out of scope:** new behaviour.

## Files
- `e2e/agent-runs.mjs` — new
- `site/src/content/docs/docs/concepts/agent-runs.md` — new
- `memory/MEMORY.md`, `plans/roadmap/R108-agent-runs-in-worktree.md`

## Acceptance criteria
- [ ] `e2e/agent-runs.mjs` proves the Done when
- [ ] `pnpm --dir site test` passes with the new page
- [ ] `vibedoc check` has no error; the epic's `## Spec changes` merge preview has no error

## Verify
```bash
pnpm lint && pnpm build && pnpm --dir site test
pnpm build:cli && node bin/vibedoc.mjs check --root .
BASE=http://localhost:3081 node e2e/agent-runs.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S1 — WHEN the user accepts a run card for a new worktree → THEN a new worktree and branch exist, the worker's commits land only there, and the user's checkout has no code changes (e2e/agent-runs.mjs passed with the stub)
- [ ] S2 — WHEN the worker claims and finishes a task in the worktree → THEN the card moves on the board in real time, like a terminal session (e2e/agent-runs.mjs: tab closed, board shows both done on reopen)
- [ ] S3 — WHEN the worker needs a decision mid-task → THEN the worker waits on the user, the inbox counts it, and the user's answer continues that task's session in the same worktree
- [ ] S4 — WHEN the worker tries a command it was not allowed (e.g. `git push`) → THEN it is refused, and the worker's log shows what was refused
- [ ] S5 — WHEN VibeDoc restarts while a worker runs → THEN the worker keeps going (including the next task) and the page follows it again, or it shows as interrupted with Resume, never silently lost
- [ ] S6 — WHEN a worker's run ends → THEN the user sees the branch diff and can open a PR, merge, or remove the worktree
- [ ] S7 — WHEN the user starts work on an epic that already has a worker → THEN the run card proposes sending it to that worker, and no second worktree is made
- [ ] S8 — WHEN the user clicks "Work with agent" → THEN a run card shows at once, and nothing is created or started until the user accepts it (e2e/agent-runs.mjs passed)
- [ ] S9 — WHEN a worker runs a UI spec → THEN it hits the worktree's own app on its own port, not the user's running app
- [ ] S10 — WHEN a task runs past its turn or time budget, or the account hits a usage limit → THEN the worker stops that task and waits on the user (budget) or shows paused and continues by itself later (usage limit), never burns on
- [ ] S11 — WHEN a task finishes with critical or major verification findings → THEN the worker fixes them once in the same worktree, else waits on the user, and only then claims the next task
- [ ] S12 — WHEN the user asks the orchestrator chat who is working on what → THEN it answers from the live workers, and any run it suggests comes as the same run card
- [ ] Open the site's Docs → Concepts → Agent runs → the page reads right: how it works, the limits, the settings table
- [ ] With a real `claude` on a small epic in a scratch repo: the whole flow, then read the branch's code
### Regression risk
- [ ] The other site docs pages and their sidebar order still look right (Agent runs is order 7, after Visual docs)
