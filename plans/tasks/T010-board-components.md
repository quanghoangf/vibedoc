# T010: Extract board components — TaskCard, BoardColumn, BoardTab
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** S (1 hr)
**Depends on:** T008

## What to build
Extract the kanban board rendering from page.tsx into three nested components.

## Scope
- [x] Create `src/components/board/TaskCard.tsx` — with STATUS_COLORS, STATUS_ICONS, NEXT_STATUS constants
- [x] Create `src/components/board/BoardColumn.tsx` — column header + task list
- [x] Create `src/components/board/BoardTab.tsx` — 4-column grid layout
- [x] Create `src/components/board/TaskDetailPanel.tsx` — placeholder for T003

## Acceptance criteria
- [x] Board renders 4 columns with tasks
- [x] Move task buttons work
- [x] Empty column shows empty state

## Definition of done
Board tab shows correctly with all tasks, move buttons trigger status changes.
