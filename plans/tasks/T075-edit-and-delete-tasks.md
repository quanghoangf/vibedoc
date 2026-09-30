# T075: Edit and delete tasks from the UI
**Status:** 📋 Ready
**Phase:** R054 — Item actions
**Size:** M
**Depends on:** —

## Goal
A user can change a task's title, size, phase, depends-on and due date, and delete a task, from the task panel. Today only the status can be changed.

## Context
- Epic: `plans/roadmap/R054-item-actions.md`
- Panel: `src/components/board/TaskDetailPanel.tsx`; card: `src/components/board/TaskCard.tsx`
- Task parsing: `parseTask` near `src/lib/core.ts:352`; `createTask` at `core.ts:496` writes the `**Key:** Value` block
- API: `src/app/api/tasks/route.ts` (has no update/delete yet). Call `emitUpdate()` after each mutation

## Scope
- [ ] `updateTaskMeta(id, fields)` and `deleteTask(id)` in core.ts: rewrite only the head meta block and keep the body byte-for-byte; append activity
- [ ] `POST /api/tasks/update` and `POST /api/tasks/delete`
- [ ] Edit title and fields in the panel; Delete in the panel's ⋯ menu and on the card
- [ ] Deleting a task removes its id from the epic's `**Tasks:**` line

## Acceptance criteria
- [ ] Editing a field leaves `## Manual tests` / `## Review` sections and the body unchanged
- [ ] A deleted task disappears from the board and from its epic's progress without a reload

## Verify
```bash
pnpm build && pnpm lint
```
