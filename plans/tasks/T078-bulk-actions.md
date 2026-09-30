# T078: Bulk actions on board and table
**Status:** ✅ Done
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

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] /board → Table view: tick the checkboxes of 3 tasks → a bar "3 selected · Status · Epic · Delete · ✕" appears at the bottom
- [ ] Status ▸ Done → all 3 move to done at once and the bar goes away
- [ ] Tick 2 tasks → Epic ▸ another epic → both show the new epic, and on /roadmap they are listed under that epic (and no longer under the old one)
- [ ] The header checkbox selects every task shown; Esc clears the selection
- [ ] Board view: Shift-click and Cmd-click two cards → they get an accent border and the bar shows "2 selected" (the panel does not open)
- [ ] Delete in the bar → both cards disappear → the toast "Deleted 2 tasks · Undo" → Undo brings both back, in the same order in their epic
### Regression risk
- [ ] A plain click on a card or a table row still opens the task panel
- [ ] Sorting by clicking a table header still works
