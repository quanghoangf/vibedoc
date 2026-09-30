# T083: Custom statuses per project
**Status:** 📋 Ready
**Phase:** R055 — Item properties
**Size:** L
**Depends on:** T081

## Goal
Each project can add, rename, recolor and reorder its statuses, mapped onto the built-in lifecycle so agents and progress still work.

## Context
- Epic: `plans/roadmap/R055-item-properties.md`
- Settings: `.vibedoc/settings.json`, settings page `src/app/(app)/settings/page.tsx`
- Everything that switches on `TaskStatus`: board columns, `roadmap-health.ts`, `board-views.ts`, `claimNextTask`, MCP tool schemas

## Scope
- [ ] `statuses: [{id, label, color, category}]` in settings; category is one of todo / active / review / blocked / paused / done / cancelled
- [ ] Logic reads the category, UI reads the label/color; unknown status in a file falls back to todo with a warning
- [ ] Settings UI to add, rename, recolor, reorder and delete (deleting asks where to move its tasks)
- [ ] MCP `vibedoc_update_task` accepts custom ids and lists them in its description

## Acceptance criteria
- [ ] A project with a custom "QA" status (category review) shows a QA column, and agents treat it like review
- [ ] Projects without the setting behave exactly as today

## Verify
```bash
pnpm build && pnpm lint
```
