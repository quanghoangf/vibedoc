# T085: Inline property editing
**Status:** 📋 Ready
**Phase:** R055 — Item properties
**Size:** L
**Depends on:** T084

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
