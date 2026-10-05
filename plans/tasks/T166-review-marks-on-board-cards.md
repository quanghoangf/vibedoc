# T166: Review marks on board cards
**Status:** ✅ Done
**Phase:** R062 — Evidence-based review
**Size:** S
**Depends on:** T164
**Owner:** ai:claude-code
**Due:** 2026-10-06
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
The board shows review state at a glance: a card in Review shows its evidence result, and a sent-back card shows how many steps were flagged and which ones.

## Context
- Epic: `plans/roadmap/R062-evidence-based-review.md`
- `latestReview(raw)` now returns `marks` (the review marks model task). Todo cards already show a "changes requested" chip (T062), and its hover shows the note.
- The evidence badge on cards comes from T156; the task's `lastRun` result is already on the task model.
- DESIGN.md metadata chips: mono 10px, Burner Amber for changes requested.

## Scope
- [ ] The task model / the `/api/tasks` payload carries `reviewMarks: { failed: number; doubt: number; steps: string[] }` from the latest changes-requested entry (parse in core, like the existing latest-review field).
- [ ] The "changes requested" chip reads `changes requested · 2 steps` when there are marks. Its hover lists the step names (max 3, then "+n").
- [ ] Review column cards show the last run result chip (`✅ 5/5` or `❌ 1 failed`). Clicking the chip opens Evidence (the same link as the T156 badge).
- [ ] Pure helper `summarizeMarks(marks)` in `src/lib/review.ts`, with a case in `review.check.mts`.

**Out of scope:** filtering or sorting the board by marks, and review assignment.

## Files
- `src/lib/review.ts` + `.check.mts`: `summarizeMarks`.
- `src/lib/core.ts`: expose `reviewMarks` on the parsed task.
- `src/types/index.ts`, `src/components/board/TaskCard.tsx`.

## Acceptance criteria
- [ ] A task sent back with 2 marks shows `changes requested · 2 steps` on its todo card, and the hover names both steps.
- [ ] A task sent back without marks (old style) shows the chip exactly as before.
- [ ] A Review card with a passed run shows `✅ n/n`. Clicking the chip opens /manual-tests on Evidence.
- [ ] `node src/lib/review.check.mts` prints ok, lint stays at the baseline, and `pnpm build` passes.

## Verify
```bash
node src/lib/review.check.mts
pnpm lint && pnpm build
# /board after a marked send back
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Send a task back from the Evidence view with 2 flagged steps → its todo card on /board reads "changes requested · 2 steps", and hovering the chip shows "Flagged: <step> · <step>" (more than 3 → "+n more")
- [ ] A task sent back with only a note (no flagged steps) → the chip reads "changes requested" and its hover shows the note, as before
- [ ] A card in the Review column whose task has a run shows a run chip: teal "✓ 5/5" when it passed, red "✗ N failed" when it failed; clicking it opens /manual-tests on that task's Evidence view (the panel doesn't open)
### Regression risk
- [ ] Clicking the card body still opens the panel and dragging a card still works; the 🧪 badge and the hover play button sit next to the new chip without wrapping oddly
