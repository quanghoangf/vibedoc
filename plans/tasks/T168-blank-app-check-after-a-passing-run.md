# T168: Blank-app check after a passing Run
**Status:** 📋 Todo
**Phase:** R063 — Honest tests
**Size:** M (2–3 hrs)
**Depends on:** T167

## Goal
A test that still passes when the app is gone proves nothing. After every passing Run from VibeDoc, the spec runs once more against a blank page, and every step that passes again is flagged **passes without the app**.

## Context
- Epic: `plans/roadmap/R063-honest-tests.md`
- Interview decision: the check runs **automatically after each passing Run from VibeDoc**. It does not run for agents running specs from a shell.
- The runner is `src/lib/test-runner.ts` (process, globalThis, one run per project). States come from `src/lib/test-run-events.ts` (pure, `RunPhase`). The route is `src/app/api/tasks/run/route.ts`, which on `passed` calls `recordRunResult` (T160).
- The run dir `<runsRoot>/<project>/<taskId>/<runId>/` belongs to VibeDoc, outside the repo. Core may write there (only `core.ts` touches fs).
- `stepVerdict(step, blankPassed)` in `src/lib/honesty.ts` (T167) already takes the blank result.

## Scope
- [ ] Fixture, `VIBEDOC_BLANK=1`:
  - every `document` request is fulfilled with an empty HTML page; other requests go through;
  - nothing is recorded (no run dir, video, run.json or EVIDENCE.md);
  - steps still report through `test.step`, so the reporter sees them.
- [ ] Runner: after a run ends `passed`, start a second pass of the same spec with `VIBEDOC_BLANK=1`. Its phase is `checking` (add it to `RunPhase` and `isRunning`). When it ends, the state goes back to `passed`, with `blankPassed: string[]` holding the names of the steps that passed again. Cancel works in both passes. An error in the blank pass leaves `blankPassed: null` ("not checked") and never fails the run.
- [ ] Core: `saveHonesty(taskId, runId, { checkedAt, blankPassed }, root)` writes `<runDir>/honesty.json`. `listRuns` / `getEvidence` read it, and the evidence rows apply `stepVerdict(step, blankPassed.includes(step.name))`.
- [ ] The route waits for the blank pass before `recordRunResult`, so the ticks (T169) see the verdict.

**Out of scope:** running the blank check from `/work-epic`, real mutation testing (epic out of scope), and the UI for the checking phase (T170).

## Files
- `src/testing/playwright-fixture.ts`: the blank mode.
- `src/lib/test-runner.ts`, `src/lib/test-run-events.ts` (+ check): the second pass and the `checking` phase.
- `src/lib/core.ts`: `saveHonesty`, read it in `listRuns` / `getEvidence`.
- `src/app/api/tasks/run/route.ts`: the order (blank pass, then record).

## Implementation notes
- The runner learns the new runId only from disk. Read it as the newest kept run of the task after the first pass, through core in the route (newest `listRuns` entry whose `startedAt` ≥ the run's start).
- `page.route('**/*', r => r.request().resourceType() === 'document' ? r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>blank</title>' }) : r.continue())` goes in the context or page fixture, only when `VIBEDOC_BLANK=1`.
- Specs that build their page with `page.setContent` pass on blank too. That's correct: they never touch the app.

## Acceptance criteria
- [ ] Run T155 from VibeDoc → state `checking`, then `passed`. Its run dir has `honesty.json` with `blankPassed: []`, and no extra run dir appears.
- [ ] A kit spec whose steps only use `page.setContent` → after the Run, `blankPassed` lists those steps and the evidence doc shows `⚠️ unverified: passes without the app`.
- [ ] Stop during the blank pass → cancelled. The first pass's run stays, with no `honesty.json`.
- [ ] `node src/lib/test-run-events.check.mts` covers the `checking` phase.

## Verify
```bash
node src/lib/test-run-events.check.mts && node src/lib/honesty.check.mts
pnpm lint && pnpm build
curl -s -XPOST localhost:3000/api/tasks/run -H 'content-type: application/json' -d '{"id":"T155"}'; sleep 25
cat ~/.vibedoc/runs/vibedoc/T155/$(ls ~/.vibedoc/runs/vibedoc/T155 | grep -E '^[0-9]{8}T' | tail -1)/honesty.json
```
