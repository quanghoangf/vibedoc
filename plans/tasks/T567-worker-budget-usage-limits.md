# T567: Worker budget and usage limits
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T557
**Covers:** S10

## Goal
A stuck worker can't burn quota all night: each task has a turn and time budget, and an account usage limit pauses the worker until it can continue, instead of failing it.

> [!WARNING]
> Spike T566: `--max-turns` counts model round trips, not tool calls (26 parallel Globs = 1 turn). Over the limit: exit 1, `result.subtype: "error_max_turns"`, `terminal_reason: "max_turns"`. Each turn streams `rate_limit_event.rate_limit_info` (`status`, `resetsAt`, `unifiedWindows.five_hour.utilization`); a rejected status was not observed, so pause above a utilization threshold and also treat a non-zero exit mentioning a limit as a usage limit. Measured: a trivial task cost 0.73 USD list (Opus), base context about 54k tokens per fresh session.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- Settings next to T557's: `workers.maxTurnsPerTask` (passed as `--max-turns`), `workers.taskTimeoutMin` (the server kills the group after it). Defaults from the spike's measured task (T566), with room.
- Over budget = stop the task (it stays in-progress), phase `wait-user` with the reason "Turn budget reached (60)" / "Took longer than 30 min"; the user can Resume (same session, budget again) or Cancel. Never claim the next task.
- Usage limit: the shape T566 recorded (a `result` error / 429 text). Phase `paused` with the reset time when the message gives one, else retry with backoff (1, 5, 15, 30 min). Counts as running for `maxRunning`, not as "needs you".
- Show per task: turns, duration, and cost / tokens from the `result` event (same numbers the spike read); the worker strip sums them.

## Scope
- [ ] Settings + defaults in core; `workerArgs` adds `--max-turns`
- [ ] Timeout in `worker-runs.ts` (kill group, record why)
- [ ] Pure `turnOutcome(resultEvent, exit, elapsed, budget)` in `src/lib/worker-state.ts` → done | over-turns | over-time | usage-limit {retryAt} | error; self-check with the spike's real excerpts
- [ ] `worker-loop.ts`: usage-limit → paused + scheduled retry (survives restart: `retryAt` in the state file)
- [ ] `WorkerStrip`: turns · time · cost per task and total; a paused worker says until when

**Out of scope:** a spending cap across workers or projects.

## Files
- `src/lib/core.ts`, `src/lib/worker-args.ts`, `src/lib/worker-state.ts`, `src/lib/worker-loop.ts` (+ checks)
- `src/lib/worker-runs.ts`
- `src/components/workers/WorkerStrip.tsx`, Settings → Workers, `src/i18n/workers.ts`
- `e2e/fixtures/claude-stub/claude` — a turn that hits max turns, one that prints a usage-limit result
- `e2e/worker-run.mjs`

## Acceptance criteria
- [ ] Stub hits `--max-turns` → the task stops, the worker waits on the user with the reason, no next task (S10)
- [ ] A task past `taskTimeoutMin` (set to 1 in the e2e) → killed, same outcome (S10)
- [ ] Stub prints a usage-limit result → phase paused with a retry time, not in the inbox; after the retry the task runs again (S10)
- [ ] Self-check parses the spike's real `result` excerpts

## Verify
```bash
node src/lib/worker-state.check.mts && node src/lib/worker-loop.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-run.mjs
```

## Manual tests
- [ ] S10 — WHEN a task runs past its turn or time budget, or the account hits a usage limit → THEN the worker stops that task and waits on the user (budget) or shows paused and continues by itself later (usage limit), never burns on
