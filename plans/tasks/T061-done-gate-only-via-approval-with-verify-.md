# T061: Manual tests page: list untested tasks, tick items
**Status:** ✅ Done
**Phase:** R043 — Task verification & review
**Size:** M
**Depends on:** T060

## Goal
One page, `/manual-tests`, lists every task that still has unticked manual test items, grouped by epic. The human works through the checklist there and ticks items off, and each tick is saved to the task file. The card badge updates as items get ticked.

## Context
- Epic: `plans/roadmap/R043-task-verification-and-review.md`
- Builds on T060: `parseManualTests()`, the `## Manual tests` section shape, and `manualTests: { total, done }` on each task.
- Decided: ticking never changes the task status. Tests are a checklist for the human, not a gate.
- Rules: fetch-only client, `emitUpdate()` after the mutation, no `localStorage`, Tailwind only. New pages go under `src/app/(app)/`, like `roadmap/` and `chat/`.

## Scope
- [ ] `toggleManualTest(raw, index, checked)` in `manual-tests.ts`: flips the Nth checkbox inside the `## Manual tests` section only
- [ ] `core.ts`: `setManualTestChecked(id, index, checked, root)`
- [ ] `POST /api/tasks/manual-tests` `{ id, index, checked }` → core, then `emitUpdate("task_updated")`. Returns 400 for a bad index and 404 for an unknown task
- [ ] `src/app/(app)/manual-tests/page.tsx`: tasks with at least 1 unticked item, grouped by epic (Phase), most recent first. Each task shows its title (links to the task detail), its status, and its items as checkboxes, split into Steps and Regression risk. Items tick inline
- [ ] A "Show fully tested" toggle to also list tasks with everything ticked
- [ ] Add a sidebar link "Manual tests" with a count of unticked items. Clicking the card badge opens the page scrolled to that task

**Out of scope:** the Review column and approve/send back (T062), notes per item, assigning testers.

## Files
- `src/lib/manual-tests.ts` + `.check.mts`: `toggleManualTest`
- `src/lib/core.ts`: `setManualTestChecked()`
- `src/app/api/tasks/manual-tests/route.ts`: new
- `src/app/(app)/manual-tests/page.tsx`: new
- `AppSidebar`, `TaskCard` (badge link)

## Implementation notes
- Index the checkboxes across the whole section in file order (Steps, then Regression risk), matching the order `parseManualTests()` returns.
- Refetch on SSE `task_updated`, the same way the board does, so ticks from another tab or a new agent report show up live.

## Acceptance criteria
- [ ] A task with a report and unticked items appears on the page. A task with no report never does
- [ ] Ticking an item writes `- [x]` in the task file, and the card badge updates live
- [ ] Unticking writes `- [ ]` back
- [ ] Once everything is ticked, the task leaves the default list and shows under "Show fully tested"
- [ ] Ticking never changes the task's status
- [ ] The self-check covers toggling in both groups and ignores checkboxes outside the section (e.g. Acceptance criteria)

## Verify
```bash
node src/lib/manual-tests.check.mts
pnpm build && pnpm lint
curl -s "localhost:3000/api/tasks/manual-tests?root=$FX" -H 'content-type: application/json' -d '{"id":"T001","index":0,"checked":true}'
# Browser: open /manual-tests?root=$FX → tick an item → the board badge goes 1/2
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Open /manual-tests → T060 and T061 are listed under R043 with their unticked items, newest report first
- [ ] Tick one item → it strikes through at once, and the task file shows - [x] for that line
- [ ] Go to /board → that task badge shows the new count; click the badge → /manual-tests scrolls to the task
- [ ] Tick the last item of a task → it stays on the page as N/N; reload → it is gone, and Show fully tested brings it back
- [ ] The sidebar Manual tests link shows the count of unticked items and drops as you tick
### Regression risk
- [ ] Ticking never changes a task status (check the card column stays the same)
- [ ] Acceptance criteria checkboxes in a task file are untouched by ticking
