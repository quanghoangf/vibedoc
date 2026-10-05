# T172: One Playwright process, many tasks: route each test's run to its task
**Status:** 📋 Ready
**Phase:** R064 — Regression suite
**Size:** M
**Depends on:** —

## Goal
A single `playwright test a.spec.ts b.spec.ts …` call records each spec's run (screenshots, video, run.json, EVIDENCE.md) under the task that owns it, and the reporter's live events say which task they belong to. This is what the suite runner builds on.

## Context
- Epic: `plans/roadmap/R064-regression-suite.md`
- Interview decision: **a suite runs as one Playwright process** with every spec path in it. It does not loop over `startRun`.
- Today the fixture takes the task from env `VIBEDOC_TASK_ID`, one task per process (T149, T153). The reporter (`src/testing/vibedoc-reporter.ts`, T157) emits `@@vibedoc {json}` lines with `step-begin | step-end | end` and a top-level step `index`, with no spec or task id.
- The fixture is compiled with `tsc -p tsconfig.playwright.json`. Relative imports use `.js`. Pure libs never import values from each other (`node *.check.mts` runs without a bundler).
- The spec path for a task is `task.manualTests.spec`, relative to the repo root. In a monorepo the app Dir comes first, and Playwright runs from the app Dir (T157 notes).

## Scope
- [ ] New env `VIBEDOC_TASK_MAP`: JSON `{ "<spec path relative to the Playwright cwd>": "T0xx" }`. The fixture resolves the task id per test: it normalises `testInfo.file` against the cwd and looks it up in the map. When the map is absent or has no entry, it falls back to `VIBEDOC_TASK_ID`, then to `no-task`, exactly as today.
- [ ] Retention (`pruneRuns`) and the EVIDENCE.md write use the resolved task id, so each task's dir is pruned and documented on its own.
- [ ] Reporter: every event also carries `file` (spec path relative to cwd) and `taskId` (from the same map, else `VIBEDOC_TASK_ID`). Add a `test-begin` / `test-end` event per test with its status, so a run with no `test.step` still reports per task. `index` counts top-level steps **within a test**.
- [ ] The pure lookup goes in `src/lib/runs-paths.ts` (or a new pure `src/lib/task-map.ts`) as `taskForFile(map, file, fallback)`, with a self-check.
- [ ] `parseRunLine` / `applyEvent` in `src/lib/test-run-events.ts` accept the new fields without breaking single-task runs. The existing check stays green and gains cases for them.

**Out of scope:** the suite runner and API (next task), any UI, and flaky retries (R065).

## Files
- `src/testing/playwright-fixture.ts`: resolve the task id per test
- `src/testing/vibedoc-reporter.ts`: `file`, `taskId`, test-begin/test-end
- `src/lib/task-map.ts` + `task-map.check.mts`: new, pure (or extend `runs-paths.ts`)
- `src/lib/test-run-events.ts` + `.check.mts`: tolerate and test the new fields

## Implementation notes
- Normalise paths with forward slashes and no leading `./` on both sides of the lookup. Windows paths and the monorepo app-Dir prefix are the likely mismatch.
- The reporter gets the test from `onStepBegin(test, result, step)`. Use `test.location.file` made relative to `config.rootDir` or the cwd, and keep it consistent with what the fixture uses.
- Parallel workers are fine: each test resolves its own task id, and the T150 rule (never prune a dir without run.json) still holds.

## Acceptance criteria
- [ ] With `VIBEDOC_TASK_MAP='{"e2e/fixtures/capture-demo.spec.ts":"T138","<another spec>":"T155"}'`, one `npx playwright test` call over both specs leaves a new run dir and an updated EVIDENCE.md under both `T138/` and `T155/`, and nothing under `no-task/`.
- [ ] Without the map, a single-task run (`VIBEDOC_TASK_ID=T155`) behaves exactly as before, and Run from /manual-tests still works.
- [ ] Reporter lines carry `file` and `taskId`. A test without steps still yields test-begin/test-end.
- [ ] Self-checks print ok. `pnpm build:playwright`, lint (baseline) and build pass.

## Verify
```bash
node src/lib/task-map.check.mts && node src/lib/test-run-events.check.mts
pnpm build:playwright && pnpm lint && pnpm build
VIBEDOC_RUNS_DIR=$(mktemp -d) VIBEDOC_TASK_MAP='{"e2e/fixtures/capture-demo.spec.ts":"T138"}' npx playwright test e2e/fixtures/capture-demo.spec.ts --reporter=list,./src/testing/vibedoc-reporter.ts
```
