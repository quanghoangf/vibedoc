# T159: Run button with live progress on Test review
**Status:** 📋 Todo
**Phase:** R061 — Run tests from VibeDoc
**Size:** M (2–3 hrs)
**Depends on:** T157

## Goal
On `/manual-tests`, a human clicks **Run** on a task and watches each step go from running to passed or failed. Automated checklist items tick as their step passes, and a failed step shows its screenshot.

## Context
- Epic: `plans/roadmap/R061-run-tests-from-vibedoc.md`
- API (T157):
  - `POST /api/tasks/run {id}`, `POST /api/tasks/run/cancel`, `GET /api/tasks/run`.
  - The SSE event `test_run` carries `{ taskId, state }`. `state.steps[]` is `{ index, name, status: running | passed | failed, error }`, and `state.state` is running, passed, failed, cancelled or error, with `tail`.
- Steps match checklist items by text, the same rule as `matchItems` in `src/lib/evidence.ts` (a 🤖 item ↔ the step with the same trimmed text).
- The detail is `src/components/manual-tests/TestDetail.tsx` (Review view: `RunPlayer` + checklist; Evidence view: `TestEvidence`). The visual rules are in DESIGN.md "Manual Test Report (signature)". There are no emoji in UI chrome.
- SSE: AppContext owns the EventSource (`src/context/AppContext.tsx`). Add `test_run` handling the way other events are routed: a small hook or context field. No second EventSource.
- Lint baseline is 17 problems. React Compiler rules apply: no setState in effects, no use before declare.

## Scope
- [ ] A **Run** button in the detail header, only when the task has a spec. It shows **Stop** while this task runs. It is disabled with a tooltip "T0xx is running" while another task in the project runs. Key `r`: add it to `TEST_REVIEW_KEYS` and keep `shortcuts.check.mts` passing. If `r` is a page jump, pick a free key and keep a/s-style ownership on this page.
- [ ] While running, a live strip replaces the run player at the top of the Review view:
  - each step with a spinner, teal check or red cross, its name, and the elapsed time;
  - "Starting the app…" before the first step.
  - The Automated checklist items tick live as their step passes (display only; T160 persists).
- [ ] On finish, the strip shows the result, then the player reloads from the new run (it refetches on `lastRun` change, `latest` prop). A failed step's screenshot shows inline once run.json lands, through the existing runs file route.
- [ ] `error` state: the message plus the last ~20 lines of `tail` in a scrollable mono block. `cancelled`: a muted line.
- [ ] Reload mid-run: `GET /api/tasks/run` restores the live strip.

**Out of scope:** Run on the task panel and card (T161), and writing ticks / `Auto:` into the file (T160).

## Files
- `src/components/manual-tests/RunLive.tsx`: new; the strip.
- `src/components/manual-tests/TestDetail.tsx`: Run/Stop button, the strip in place of the player while running, live ticks on Automated items.
- `src/context/AppContext.tsx` (or a small `useTestRun()` hook next to it): the current run state from SSE plus the initial GET.
- `src/app/(app)/manual-tests/page.tsx`: the run key. `src/lib/shortcuts.ts`.
- `DESIGN.md`: signature section, the Run strip.

## Implementation notes
- Elapsed time per step: stamp `Date.now()` client-side on step-begin; there is no need to add times to the event.
- Map steps to Automated items by normalised text. Steps that match no item are still listed in the strip.

## Acceptance criteria
- [ ] Click Run on T155 → "Starting the app…", then 5 steps go running → passed one after another. The 5 Automated items tick live. When it ends, the player shows the new run.
- [ ] Stop mid-run → cancelled, no ticks persist.
- [ ] Run a task whose spec has a deliberately wrong expectation → that step is red and its screenshot shows after the run.
- [ ] Reload during a run → the strip comes back where it was.
- [ ] Lint stays at the baseline, and `shortcuts.check` passes.

## Verify
```bash
node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
# open http://localhost:3000/manual-tests?tab=all&task=T155 → Run
```
