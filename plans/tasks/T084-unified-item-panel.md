# T084: Unified item panel
**Status:** 📋 Ready
**Phase:** R055 — Item properties
**Size:** L
**Depends on:** T080

## Goal
Tasks, epics and docs open in the same kind of panel: a properties header, the content, then activity, instead of three different layouts.

## Context
- Epic: `plans/roadmap/R055-item-properties.md`
- Today: `src/components/board/TaskDetailPanel.tsx`, `src/components/roadmap/RoadmapItemSheet.tsx`, `src/components/docs/DocViewer.tsx`
- Session history: `src/components/board/TaskSessions.tsx`

## Scope
- [ ] One panel shell with slots: title, properties grid (status, owner, due, size, parent/epic), body, activity
- [ ] Move task and epic panels onto it; the doc header uses the same properties row
- [ ] The ⋯ menu from R054 sits in the same spot everywhere

## Acceptance criteria
- [ ] Opening a task, an epic and a doc shows the same header layout
- [ ] Deep links `/board?task=` and `/roadmap?item=` still open the right item

## Verify
```bash
pnpm build && pnpm lint
```
