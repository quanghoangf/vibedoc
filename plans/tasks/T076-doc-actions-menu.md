# T076: Doc actions menu in the doc header
**Status:** 📋 Ready
**Phase:** R054 — Item actions
**Size:** S
**Depends on:** —

## Goal
The open doc has a ⋯ menu in its header, so actions don't depend on hovering over the list.

## Context
- Epic: `plans/roadmap/R054-item-actions.md`
- Header: `src/components/docs/DocViewer.tsx`; the existing hover menu is in `src/components/docs/DocList.tsx:180`
- APIs: `/api/docs` PATCH (rename → `renameDoc`), DELETE (`deleteDoc`), POST (`createDoc`)

## Scope
- [ ] Menu: Rename, Move to folder, Duplicate, Copy path, Copy link (`/docs?doc=`), Chat about this doc, Delete
- [ ] The same menu on right-click in the doc list (reuse one component for both)

## Acceptance criteria
- [ ] Rename/move keeps the doc open under its new path
- [ ] Duplicate opens the copy named `<name>-copy.md`

## Verify
```bash
pnpm build && pnpm lint
```
