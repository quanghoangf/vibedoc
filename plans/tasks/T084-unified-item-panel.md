# T084: Unified item panel
**Status:** ✅ Done
**Phase:** R055 — Item properties
**Size:** L
**Depends on:** T080
**Owner:** ai:claude
**Due:** 2026-10-07
**Started:** 2026-09-30
**Done:** 2026-09-30

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

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Open a task on /board → header: "T0xx · task" with the ⋯ at the top right, the title, then Status / Owner / Due / Size / Epic rows
- [ ] The task body no longer repeats the title and the **Key:** lines; Manual tests, review history and Sessions sit below the body in the same scroll
- [ ] Open an epic on /roadmap → same header: "<horizon> › R0xx · epic", ⋯ at the top right, Status / Owner / Due / Tasks rows, then the progress bar
- [ ] Open a doc on /docs → same header: folder · doc, the file name, Owner / Edited rows, ⋯ at the top right (it moved out of the editor bar)
- [ ] /board?task=T0xx and /roadmap?item=R0xx still open the right item
### Regression risk
- [ ] Task edit form, review Approve / Send back and the epic Edit form still work from the new headers
