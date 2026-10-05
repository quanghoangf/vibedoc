# T166: Review marks on board cards
**Status:** 📋 Ready
**Phase:** R062 — Evidence-based review
**Size:** S
**Depends on:** T164

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
