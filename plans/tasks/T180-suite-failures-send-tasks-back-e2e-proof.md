# T180: Suite failures send tasks back + e2e proof + docs
**Status:** 📋 Ready
**Phase:** R065 — Self-fixing failures & flaky tests
**Size:** M (2–3 hrs)
**Depends on:** T177, T179, T173, T174

## Goal
A regression suite run treats broken tasks the same way a single Run does: each broken done task is sent back (subject to the cap), and flaky tasks are labelled, not broken. An e2e script proves the epic's Done-when, and the docs describe the flow.

## Context
- Epic: `plans/roadmap/R065-self-fixing-failures-flaky-tests.md`. **Done when:** "a deliberately broken step returns the task to the agent with its screenshot, and a randomly failing test is labelled flaky after retries".
- Suite runner and API from R064: `startSuite`, `applySuiteEvent`, `POST /api/suite/run`, and the end-of-suite per-task result writer (T173). The Suite tab is T174.
- Reuse `failedMarksForRun`, the auto send-back and the cap logic from the previous tasks. Move the "on run end: write result → send back or cap" step into one core/lib function both routes call, rather than copying it.
- R064's e2e check (T175) shows the pattern for an e2e script against a fixture task.

## Scope
- [ ] Extract `handleRunEnd(taskId, run, root)` (or similar) used by `POST /api/tasks/run` and the suite end. It covers the T160 writer, the auto send-back and the cap. The suite emits one `task_updated` per changed task.
- [ ] Suite state: a task whose tests were only flaky has status `flaky` (counted as passed). The Suite tab lists it under passed with the amber chip, and the summary reads "Passed · 12/12 tasks · 1 flaky".
- [ ] e2e script `e2e/self-fixing.mjs` (or extend T175's): (1) a fixture done task with a deliberately broken step → after a Run, the task is todo with a failed mark that names a screenshot file that exists; (2) a fixture test that fails randomly / on its first attempt → after a Run, it is labelled flaky and the task stays done; (3) the cap → review after N.
- [ ] Docs: `docs/architecture/mcp-tools.md` "Manual tests & review" (auto send-back, flaky, the cap, the `tests.*` settings, the updated lifecycle diagram), and `vibedoc_get_evidence` (the flaky line).

**Out of scope:** CI, auto-merging fixes, and quarantine (epic out of scope).

## Files
- `src/lib/core.ts` (or a new `src/lib/run-end.ts` + core call): shared end handler
- `src/app/api/tasks/run/route.ts`, `src/app/api/suite/run/route.ts`, `src/lib/suite.ts` + check
- `src/components/manual-tests/SuiteTab.tsx`
- `e2e/self-fixing.mjs`, `docs/architecture/mcp-tools.md`

## Acceptance criteria
- [ ] A suite run with one broken done task and one flaky task → the broken task is todo with its failed mark + screenshot. The flaky task stays done, shows as flaky in the Suite tab, and the suite is `passed`.
- [ ] `node e2e/self-fixing.mjs` passes all three cases.
- [ ] `suite.check.mts` covers the flaky task status.
- [ ] Docs updated. Lint stays at the baseline, and the build passes.

## Verify
```bash
node src/lib/suite.check.mts
node e2e/self-fixing.mjs
pnpm lint && pnpm build
```
