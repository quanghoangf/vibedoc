# T163: Approve / Send back in the Evidence view; review tasks open on Evidence
**Status:** 📋 Ready
**Phase:** R062 — Evidence-based review
**Size:** M
**Depends on:** T162

## Goal
A task in review can be approved or sent back right where the evidence is, and every way into a review task (the Review column card, the task panel, /manual-tests) lands on the Evidence view first.

## Context
- Epic: `plans/roadmap/R062-evidence-based-review.md`
- Approve and send back already exist: `POST /api/tasks/review` `{ id, action: "approve" | "send-back", note? }` → `approveTask` / `sendBackTask` in `src/lib/core.ts`, which write a `## Review` entry (T062). Today the buttons live in the task panel and the Review view of `/manual-tests`.
- The Evidence view is `src/components/manual-tests/TestEvidence.tsx`, shown by `TestDetail.tsx` with `?view=evidence&run=` (T155). The task panel and card badge already link to it (T156).
- This task starts after R061 (T162), because R061 also edits `TestDetail` (Run button).
- Rules: only `core.ts` touches fs, routes call `emitUpdate()`, no localStorage, Tailwind only, lint stays at the baseline (17 problems), and no setState in effects.

## Scope
- [ ] A review action bar at the top of the Evidence view, shown only when the task status is `review`: **Approve** and **Send back…**. Send back opens the same note textarea the Review view uses. Reuse or extract that component; don't fork it.
- [ ] The bar shows which run it reviews (the selected `&run=`, or the newest). Approving while you look at an older run shows a one-line warning: "You're looking at an older run".
- [ ] Default view: a review-status task opens with `view=evidence` when no `view` param is given. This applies on /manual-tests, from the Review column card click (board → task panel) and from the panel's evidence link. Other statuses keep today's default.
- [ ] Task panel: for review tasks, an **Open evidence** primary button next to Approve / Send back, linking to `/manual-tests?task=<id>&view=evidence`.
- [ ] After Approve or Send back, the bar disappears live (SSE `task_updated`), and the `## Review` history in the panel shows the new entry.

**Out of scope:** per-step marks and the generated note (T-review-marks tasks below), board chips, multi-reviewer approval, review assignment.

## Files
- `src/components/manual-tests/TestEvidence.tsx`: the review action bar.
- `src/components/manual-tests/TestDetail.tsx` / `src/app/(app)/manual-tests/page.tsx`: the default view for review tasks.
- The task panel (the unified item panel from T084) and the existing approve/send-back UI: extract a shared `ReviewActions` component if it's inline today.

## Implementation notes
- Work out the default view while rendering (`view ?? (status === "review" ? "evidence" : "review")`). Don't write the URL in an effect.
- Keep `v` toggling both ways, and keep Esc / j/k behaviour unchanged.

## Acceptance criteria
- [ ] Moving a task to review and opening it from /manual-tests shows Evidence with Approve / Send back. Approve → the task is done and `### … — approved` is appended.
- [ ] Send back with a note from Evidence → the task goes to todo with the note. An empty note stays blocked.
- [ ] A non-review task's Evidence view has no action bar.
- [ ] Clicking a Review column card, then Open evidence, lands on Evidence.
- [ ] Lint stays at the baseline, and `pnpm build` passes.

## Verify
```bash
pnpm lint && pnpm build
# move a task with runs (e.g. T155) to review via vibedoc_update_task, open /manual-tests?task=T155 → Evidence + actions
```
