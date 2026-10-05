# T161: Run from the task panel and the board card
**Status:** 📋 Todo
**Phase:** R061 — Run tests from VibeDoc
**Size:** S (~1–2 hrs)
**Depends on:** T159

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
