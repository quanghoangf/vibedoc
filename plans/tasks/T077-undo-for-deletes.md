# T077: Undo for deletes
**Status:** 📋 Ready
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
