# T177: Flaky shown separately: chips, Flaky filter, not counted as broken
**Status:** ✅ Done
**Phase:** R065 — Self-fixing failures & flaky tests
**Size:** M (2–3 hrs)
**Depends on:** T176
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
A flaky test is visible but doesn't raise a false alarm: it gets its own amber label everywhere a run result shows, its own filter on /manual-tests, and it is never counted as failed, in Needs you or in the sidebar count.

## Context
- Epic: `plans/roadmap/R065-self-fixing-failures-flaky-tests.md` (in scope: "flaky tests shown separately and not counted as broken").
- Data from the previous task: run.json `tests[].outcome/attempts/firstFailure`, run-level `flaky`, live state `retried` per step, task `autoRun.flaky`.
- Places that show a run result: `/manual-tests` tabs (Needs you · Failed · Passed · No run · All), `RunLive.tsx` (step rows), `TestEvidence` / the Evidence view, the board card result chips (T166), and the `vibedoc_get_evidence` doc (`src/lib/evidence.ts` formatter).
- DESIGN.md "Manual Test Report (signature)" sets the visual rules. No emoji in UI chrome. Lint baseline 17. React Compiler: no setState in effects.

## Scope
- [ ] `/manual-tests`: a **Flaky** tab (`?tab=flaky`) for tasks whose last run had flaky tests. These tasks stay in Passed and are **not** in Needs you or Failed. The sidebar badge count does not include them.
- [ ] `RunLive` step rows: a step that passed on retry shows an amber "passed on retry 2/3" marker instead of the plain teal check.
- [ ] Evidence view: a flaky item shows an amber **Flaky** chip and a collapsible "First attempt failed" with that attempt's error and screenshot (from `firstFailure`).
- [ ] Board card: the run result chip shows `passed · 1 flaky` in amber, not red.
- [ ] `vibedoc_get_evidence` / `formatEvidence`: flaky items are marked `🔁 flaky (passed on attempt 2)` with the first failure's error, and the run summary line names the flaky count. Add a case to `evidence.check.mts`.
- [ ] DESIGN.md: one line on the flaky colour and chip.

**Out of scope:** suite UI flaky rows (T174 owns that UI, see the last task), quarantining or skipping flaky tests, and flaky trends across runs.

## Files
- `src/app/(app)/manual-tests/page.tsx`: the tab and the counts
- `src/components/manual-tests/RunLive.tsx`, `TestEvidence.tsx` / `TestDetail.tsx`
- the board card component from T166
- `src/lib/evidence.ts` + check; the Needs-you / sidebar count helper (wherever T160's "failed last run" check lives)
- `DESIGN.md`

## Acceptance criteria
- [ ] After a fail-once run (previous task), the task is under Passed and Flaky, not under Needs you or Failed, and the sidebar count is unchanged.
- [ ] The Evidence view shows the Flaky chip and the first attempt's error + screenshot. The board card chip is amber.
- [ ] During a live run, the retried step shows "passed on retry".
- [ ] `vibedoc_get_evidence` shows the flaky line.
- [ ] Lint stays at the baseline, and the build and checks pass.

## Verify
```bash
node src/lib/evidence.check.mts
pnpm lint && pnpm build
# open http://localhost:3000/manual-tests?tab=flaky
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Run a task whose spec fails once and passes on the retry → during the run the step shows an amber check + "flaky" chip, and the verdict reads "Passed · 1/1 steps · 1 flaky" (agent checked with a throwaway spec on T153, since restored)
- [ ] /manual-tests → the Flaky tab (amber count) lists that task, Passed includes it, Failed and Needs you don't (if it isn't in review), and the sidebar count is unchanged
- [ ] Its Evidence doc reads "… · 1 flaky" and under the step "🔁 flaky (passed on attempt 2); the first attempt failed:" with the error and a first-attempt screenshot; `vibedoc_get_evidence` returns the same lines
- [ ] Put it in review → Steps to review shows the "flaky" chip and a "First attempt failed (passed on attempt 2)" fold with the error and thumbnail
- [ ] On /board its run chip reads `1/1 · 1 flaky` in amber, and the 🧪 badge is amber
### Regression risk
- [ ] A plain passed run still shows teal everywhere and a failed run red; Needs you / Failed counts are unchanged for non-flaky tasks
