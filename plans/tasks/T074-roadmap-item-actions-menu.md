# T074: Roadmap item actions menu
**Status:** 📋 Ready
**Phase:** R054 — Item actions
**Size:** M
**Depends on:** —

## Goal
Every epic and horizon has a ⋯ / right-click menu on the map node and in the sheet header, so a user can act without opening the Edit form.

## Context
- Epic: `plans/roadmap/R054-item-actions.md`
- Map nodes: `src/components/roadmap/RoadmapNodes.tsx`; sheet: `src/components/roadmap/RoadmapItemSheet.tsx` (Delete is currently only in `ItemForm`, behind `window.confirm`)
- APIs exist: `/api/roadmap/{create,update,delete}` → `createRoadmapItem` / `updateRoadmapItem` / `deleteRoadmapItem` in `src/lib/core.ts`
- Menu primitive: `src/components/ui/dropdown-menu.tsx`

## Scope
- [ ] Menu items: Edit, Change status ▸ (planned / in-progress / done), Move to horizon ▸, Add epic (horizons only), Duplicate, Open file, Chat about it, Delete
- [ ] Same menu on right-click on a map node and on the Timeline bar
- [ ] Delete from the menu (the Undo toast comes in T077; until then keep the confirm)

## Acceptance criteria
- [ ] Status change and horizon move from the menu write the R*.md file and the map updates via SSE
- [ ] Duplicate creates a new id with the same body and parent, and no tasks attached
- [ ] Deleting a horizon that still has epics is refused with a clear message

## Verify
```bash
pnpm build && pnpm lint
```
