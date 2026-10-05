# T161: Run from the task panel and the board card
**Status:** ✅ Done
**Phase:** R061 — Run tests from VibeDoc
**Size:** S (~1–2 hrs)
**Depends on:** T159
**Owner:** ai:claude-code
**Due:** 2026-10-06
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
A task's tests can be re-run from where people already look: the board card and the task panel, not only from /manual-tests.

## Context
- Epic: `plans/roadmap/R061-run-tests-from-vibedoc.md`
- The run state hook and API come from T157 / T159 (`useTestRun()` or the AppContext field). Reuse the Run/Stop logic from T159. Extract it into a small `RunButton` if T159 kept it inline in `TestDetail`.
- The card is `src/components/board/TaskCard.tsx`:
  - it is a `role="button"` and draggable;
  - the 🧪 badge is a link to the Evidence view (T156) and stops click, keydown and dragstart propagation;
  - a Run control on the card must do the same.
- The panel's runs section is `src/components/board/TaskRuns.tsx` (header: "Runs" + "Evidence →").

## Scope
- [ ] Panel: a Run / Stop button in the `TaskRuns` header, only when the task has a spec. While its task runs, a one-line live summary shows ("Step 3 of 5 · Click …"); otherwise the newest run as today.
- [ ] Card: a small play icon button next to the 🧪 badge.
  - It shows only on hover or focus, and only when the task has a spec. It turns into a spinner while that task runs.
  - It is disabled with a tooltip while another task in the project runs.
  - Its label is "Run T0xx tests".
- [ ] Both refresh from the same SSE state, with no extra fetch per card.

**Out of scope:** running several tasks at once and the regression suite (R064).

## Files
- `src/components/board/TaskRuns.tsx`, `src/components/board/TaskCard.tsx`
- `src/components/manual-tests/RunButton.tsx` (if extracted from T159)

## Acceptance criteria
- [ ] Card play → the card spins, and /manual-tests (another tab) shows the live strip for that task.
- [ ] Panel Run → the live line advances step by step. Stop → cancelled.
- [ ] Clicking the card body still opens the panel. Dragging a card still works.
- [ ] Lint stays at the baseline.

## Verify
```bash
pnpm lint && pnpm build
# /board → hover a card with a spec → play; open its panel → Runs → Run / Stop
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] On /board, hover a card whose task has a spec → a small play button appears next to the 🧪 badge (hidden otherwise); click it → it turns into a spinner and the task panel does not open
- [ ] With that run going, open /manual-tests on the same task in another tab → the live strip shows the same run; the card's spinner turns back into play when it ends
- [ ] Open a task panel with a spec → Runs header has Run; click it → "Starting the app…", then "Step N · <step text>" advances; Stop → the line goes away and Run is back
- [ ] While one task runs, the play / Run of every other task is disabled with "T0xx is running"
### Regression risk
- [ ] Clicking a card body still opens the panel, the 🧪 badge still opens the Evidence view, and dragging a card between columns still works
- [ ] A task without a spec shows no play button and its panel's Runs section is as before
