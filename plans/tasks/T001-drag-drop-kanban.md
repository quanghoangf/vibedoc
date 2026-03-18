# T001: Drag-and-Drop Kanban Board
**Status:** ✅ Done
**Phase:** 1 — Polish
**Size:** M (3-5 hrs)
**Depends on:** —

## What to build
Add drag-and-drop to the kanban board so tasks can be moved between columns by dragging. Use the HTML5 Drag and Drop API (no extra library needed).

## Scope
- [ ] Make `TaskCard` components draggable (`draggable` attribute + `onDragStart`)
- [ ] Make columns drop targets (`onDragOver` + `onDrop`)
- [ ] Visual feedback: dragging card gets 50% opacity, target column gets accent border
- [ ] On drop: call `POST /api/tasks` with new status
- [ ] Optimistic UI update (move card immediately, revert on error)
- [ ] Works alongside existing hover-button approach (keep both)

## Files to touch
- `src/app/page.tsx` — `TaskCard` component + column drop handlers

## Acceptance criteria
- [ ] Can drag a task from `todo` to `in-progress` and it moves
- [ ] Card opacity changes while dragging
- [ ] Target column highlights on hover
- [ ] Drop triggers API call + file write
- [ ] SSE fires after status update → activity feed shows the move
- [ ] Works on Chrome, Firefox, Safari
- [ ] No new npm packages added

## Do NOT
- Don't add `react-dnd`, `@dnd-kit`, or any DnD library — HTML5 native is enough
- Don't break the existing hover-button quick actions
- Don't add touch drag support yet (that's a future task)

## Definition of done
Drag card from any column to any other column. File is updated on disk. Activity feed shows the move. `npm run build` passes.
