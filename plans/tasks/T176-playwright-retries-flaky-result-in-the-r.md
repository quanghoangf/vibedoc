# T176: Playwright retries + flaky result in the run model
**Status:** ✅ Done
**Phase:** R065 — Self-fixing failures & flaky tests
**Size:** M (2–3 hrs)
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
Every VibeDoc run retries failing tests, and a test that fails and then passes on retry is recorded as **flaky**, not failed. The data lands in run.json, the live run state and the task's Auto header, so later tasks can show it and skip send-back for it.

## Context
- Epic: `plans/roadmap/R065-self-fixing-failures-flaky-tests.md`
- Interview decision: flakiness comes from **Playwright's own retries** (`--retries=N`). Playwright's `TestCase.outcome()` returns `"flaky"` when a test fails and then passes on retry. VibeDoc does not re-run specs itself, and flakiness is not inferred from run history.
- Runner: `src/lib/test-runner.ts` (T157) spawns `npx playwright test <spec> --reporter=list,<reporter>`. Events are folded by `src/lib/test-run-events.ts` (with `test-run-events.check.mts`).
- Capture: `src/testing/playwright-fixture.ts` writes run.json / steps per test (T149/T153). Its copy in the shipped kit (`e2e/vibedoc/kit/testing/playwright-fixture.ts`, `e2e/vibedoc/kit/VERSION`) must stay in sync.
- Run result writer: T160 (`autoRun: { result, date }`, `ticksForRun` in `src/lib/evidence.ts`).
- CLAUDE.md: only `src/lib/core.ts` touches fs. Routes call `emitUpdate()`.

## Scope
- [ ] Setting `tests.retries` in `.vibedoc/settings.json` (default 2, 0 turns it off), read through core. The runner adds `--retries=<n>` to single runs; T173's `startSuite` gets the same once it exists (one shared arg builder).
- [ ] The reporter/fixture records the attempt count per test and the final outcome `passed | failed | flaky | skipped`. Steps come from the **last attempt**. The first failing attempt's error and screenshot are kept as `firstFailure` on that test so a reviewer can see what went wrong.
- [ ] run.json: `tests[].outcome`, `tests[].attempts`, `tests[].firstFailure?`, plus a run-level `flaky: number`. Older run.json files without these fields still parse (treated as attempts 1, outcome from status).
- [ ] `applyTestRunEvent` handles retry events: a step row that fails and then passes on retry ends `passed` with `retried: true`. The run state is `passed` when every test passed or was flaky, and carries `flaky` as a count.
- [ ] Auto header: a run with flaky tests writes `Auto: passed <date> · 1 flaky`. The manual-tests parser reads it back (`autoRun.flaky`), and old headers parse unchanged. `ticksForRun` ticks a flaky item's step like a passed one.
- [ ] Bump the kit VERSION and mirror the fixture/lib changes into `e2e/vibedoc/kit/`.

**Out of scope:** any UI for flaky (next task), send-back (T-auto send-back), quarantine.

## Files
- `src/lib/test-runner.ts`: `--retries`, shared arg builder
- `src/lib/test-run-events.ts` + `.check.mts`: retry/flaky folding
- `src/testing/playwright-fixture.ts`, `src/lib/evidence.ts`, `src/lib/runs-paths.ts` (if run.json types live there) + the `e2e/vibedoc/kit/` copies
- `src/lib/manual-tests.ts` (+ check): `· N flaky` in the Auto header
- `src/lib/core.ts`: read `tests.retries`

## Implementation notes
- Prefer reading `result.retry` / `test.outcome()` in the custom reporter over parsing list output.
- Keep run.json backward compatible: the Evidence view and `vibedoc_get_evidence` read old kept runs.

## Acceptance criteria
- [ ] A throwaway spec that fails on its first attempt and passes on the second (counter file) → the run is `passed`, run.json has `outcome: "flaky"`, `attempts: 2`, `firstFailure` with error + screenshot, and the task header reads `Auto: passed <today> · 1 flaky`.
- [ ] A spec that always fails → `failed` after 3 attempts (default retries 2).
- [ ] `tests.retries: 0` → no retry, the same spec fails on its first attempt.
- [ ] Self-checks cover: flaky folding, old run.json without the new fields, header round trip with and without flaky.
- [ ] Lint stays at the baseline, and the build passes.

## Verify
```bash
node src/lib/test-run-events.check.mts && node src/lib/manual-tests.check.mts && node src/lib/evidence.check.mts
pnpm lint && pnpm build
# Run a task with a fail-once spec from /manual-tests, then: cat ~/.vibedoc/runs/vibedoc/<task>/<run>/run.json | jq '.flaky, .tests[].outcome'
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Give a task a kit spec that fails on its first attempt and passes on the second (e.g. a counter file), then Run tests → the run ends passed; GET /api/tasks/run shows `flaky: 1` and the step `retried: true`; the task header reads `Auto: passed <today> · 1 flaky` (agent checked with a throwaway spec on T153, since restored)
- [ ] That run's run.json has `tests: [{ outcome: "flaky", attempts: 2, firstFailure: { step, error, screenshot } }]`, `flaky: 1`, and a `first-failure-…png`; only one run folder exists for the run
- [ ] A spec that always fails → `failed` after 3 attempts (one run folder, `attempts: 3`)
- [ ] `"tests": { "retries": 0 }` in .vibedoc/settings.json → the same spec fails on its first attempt (`attempts: 1`)
### Regression risk
- [ ] Older runs without `tests` / `flaky` still show in the Evidence view and the task panel's Runs
- [ ] The blank-page honesty check still runs once after a pass (no retries there) and the regression suite still runs (with retries)
