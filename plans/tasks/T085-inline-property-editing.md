# T085: Inline property editing
**Status:** ✅ Done
**Phase:** R055 — Item properties
**Size:** L
**Depends on:** T084
**Owner:** ai:claude
**Due:** 2026-10-07
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
A user edits status, owner, due and size right where they see them (card, table cell, panel header, map node) without opening a form.

## Context
- Epic: `plans/roadmap/R055-item-properties.md`
- Surfaces: `TaskCard.tsx`, `views/TableView.tsx`, the panel from T084, `RoadmapNodes.tsx`
- Writes go through the update endpoints from T074/T075

## Scope
- [ ] Click a property → small popover (select for status/owner/size, `<input type="date">` for due)
- [ ] Optimistic update, rolled back with an error message if the write fails
- [ ] Keyboard: Enter to save, Esc to cancel

## Acceptance criteria
- [ ] Changing a due date in a table cell updates the file and the Timeline view without a reload
- [ ] The epic's RoadmapItemSheet form is only needed for title and body

## Verify
```bash
pnpm build && pnpm lint
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] /board → Table: click a Due cell → a date field; pick a date, Enter → saved to the file; Esc instead → nothing changes
- [ ] Click a Status, Owner or Size cell → a small menu; pick a value → the cell and the task file change at once
- [ ] Board cards: click the size chip, the due chip or the owner chip → edit it in place (the panel does not open)
- [ ] Task panel header: Status, Owner, Due and Size are editable the same way
- [ ] /roadmap: open an epic → Status, Owner and Due in the header are editable in place (the Edit form is now only needed for title, brief, tasks and order)
- [ ] With the dev server stopped, change a value → a toast says it could not be saved and the old value comes back
### Regression risk
- [ ] Clicking elsewhere on a card or table row still opens the task; dragging cards still works
- [ ] Timeline view: due diamonds show only for dates inside the shown time range (unchanged behavior)
