# T078: Bulk actions on board and table
**Status:** 📋 Ready
**Phase:** R054 — Item actions
**Size:** M
**Depends on:** T075

## Goal
A user can select several tasks and change their status, owner or epic, or delete them, in one step.

## Context
- Epic: `plans/roadmap/R054-item-actions.md`
- Views: `src/components/board/views/TableView.tsx`, `BoardView.tsx`; shell `src/components/board/BoardTab.tsx`
- Doc list already has a select mode (`SelectionCtx` in `DocList.tsx`) — follow that pattern

## Scope
- [ ] Checkbox selection in Table, shift/cmd-click in Board
- [ ] Action bar: Status ▸, Epic ▸, Delete (Owner ▸ once T080 lands)
- [ ] One SSE refresh for the whole batch, not one per item

## Acceptance criteria
- [ ] Moving 5 tasks to done updates all 5 files and the board once
- [ ] Bulk delete can be undone as one action (after T077)

## Verify
```bash
pnpm build && pnpm lint
```
