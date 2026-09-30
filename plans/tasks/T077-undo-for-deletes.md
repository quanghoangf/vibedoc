# T077: Undo for deletes
**Status:** ✅ Done
**Phase:** R054 — Item actions
**Size:** M
**Depends on:** T074, T075, T076

## Goal
Deleting a task, epic or doc shows a toast with Undo for a few seconds, instead of a `window.confirm` dialog.

## Context
- Epic: `plans/roadmap/R054-item-actions.md`
- Current confirms: `RoadmapItemSheet.tsx:227`, `DocList.tsx:335`
- No toast component exists yet in `src/components/ui/`

## Scope
- [ ] A small toast (Tailwind only, no new library unless one is already installed)
- [ ] Undo restores the file with its exact previous content (the delete endpoints return the removed content, the client re-creates it)
- [ ] Remove the `window.confirm` calls for single deletes

## Acceptance criteria
- [ ] Delete → Undo gives back a byte-identical file, and the epic's `**Tasks:**` link when it was a task
- [ ] Undo on a doc also restores the open tab

## Verify
```bash
pnpm build && pnpm lint
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] /board: hover a card → ⋯ → Delete → no confirm dialog; the card disappears and a toast "Deleted T0xx · Undo" shows at the bottom
- [ ] Click Undo → the card comes back, the task file is identical to before, and it is back in the same spot in its epic's **Tasks:** line
- [ ] /roadmap: right-click an epic with no children → Delete → toast → Undo → the epic comes back at the same place on the map
- [ ] /docs: open a doc → ⋯ → Delete → toast → Undo → the doc comes back with the same content and is open again
- [ ] Wait ~8 s after a delete without clicking Undo → the toast goes away and the item stays deleted
### Regression risk
- [ ] Deleting a horizon that still has epics is still refused (Delete greyed out)
- [ ] Deleting a saved board view still asks for confirmation (unchanged)
