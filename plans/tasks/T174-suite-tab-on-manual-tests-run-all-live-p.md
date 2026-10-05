# T174: Suite tab on /manual-tests: run all, live progress, broken tasks with screenshot
**Status:** 📋 Ready
**Phase:** R064 — Regression suite
**Size:** M
**Depends on:** T173

## Goal
On `/manual-tests`, a human opens the **Suite** tab, clicks **Run suite** and sees every done task's spec run. When it ends, the tasks that broke are listed first, each with its failing step, error and screenshot, and one click opens that task's Evidence.

## Context
- Epic: `plans/roadmap/R064-regression-suite.md`
- Interview decision: the suite UI is **a tab on /manual-tests**, not a new page.
- API (previous task): `POST /api/suite/run`, `GET /api/suite/run`, `POST /api/suite/run/cancel`, and the SSE event `suite_run` with `{ state, tasks[{ taskId, status, steps, failedStep }] }`.
- Reuse:
  - `src/components/manual-tests/RunLive.tsx`: the step-row visuals (spinner, teal check, red cross, elapsed time).
  - `TestDetail` / `TestEvidence`: the Evidence view a broken task links to (`/manual-tests?tab=all&task=T0xx` opening on Evidence).
  - The runs file route for screenshots, which T159 uses for the failed-step frame.
- SSE: AppContext owns the one EventSource (`src/context/AppContext.tsx`). Route `suite_run` the way T159 routes `test_run`, with no second EventSource.
- The visual rules are in DESIGN.md "Manual Test Report (signature)". There are no emoji in UI chrome. Lint baseline is 17. React Compiler rules apply: no setState in effects.

## Scope
- [ ] A **Suite** tab next to the existing tabs, with a URL param (`?tab=suite`). The header shows how many done tasks have a spec and how many done tasks have none ("12 specs · 4 done tasks without a spec").
- [ ] **Run suite** / **Stop** button. It is disabled with a tooltip while a single-task run is going ("T0xx is running"). The single-task Run button is likewise disabled with "Suite is running" (T159 / T161 entry points). Add a key to `TEST_REVIEW_KEYS` if a free one fits, and keep `shortcuts.check.mts` passing.
- [ ] While running: one row per task with status (queued, running with the current step name, passed, failed), plus a progress line "7/12 tasks". "Starting the app…" shows before the first event.
- [ ] When it ends: a summary "Failed · 2 of 12 tasks broke" or "Passed · 12/12 tasks". **Broken tasks come first**, each showing the task id + title, the failing step name, the first error line, and that step's screenshot inline (once run.json lands). An **Open evidence** link goes to the task's Evidence view. Passed tasks sit below, collapsed.
- [ ] `error` state: the message plus the last ~20 lines of tail in a mono block. `cancelled`: a muted line. Reloading mid-run restores the state from `GET /api/suite/run`.
- [ ] DESIGN.md: a short note on the Suite tab in the signature section.

**Out of scope:** the e2e check and docs (next task), the health view and per-file "related" runs (dropped from R064), and flaky labels (R065).

## Files
- `src/components/manual-tests/SuiteTab.tsx`: new
- `src/app/(app)/manual-tests/page.tsx`: the tab and the key
- `src/context/AppContext.tsx` (or a `useSuiteRun()` hook next to `useTestRun`): suite state from SSE + the initial GET
- `src/components/manual-tests/TestDetail.tsx` (+ the task panel / card Run from T161): disable while a suite runs
- `src/lib/shortcuts.ts`, `DESIGN.md`

## Implementation notes
- Find the screenshot of the failing step through the task's newest run (the same lookup T159 uses for the failed frame), not from the SSE payload.
- Keep rows compact: a suite can have dozens of tasks. Don't render every step of passed tasks.

## Acceptance criteria
- [ ] Open `/manual-tests?tab=suite` → the counts match the done tasks with and without a spec.
- [ ] Run suite → rows go queued → running → passed live. At the end, the summary is correct and the player-free list shows all tasks.
- [ ] With one done task's spec deliberately broken, that task is listed first with its step name, error and screenshot, and Open evidence lands on its Evidence view showing the same failure.
- [ ] Stop mid-run → cancelled, and the single-task Run buttons are enabled again. Reloading mid-run restores the rows.
- [ ] Lint stays at the baseline. `shortcuts.check` and the build pass.

## Verify
```bash
node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
# open http://localhost:3000/manual-tests?tab=suite → Run suite
```
