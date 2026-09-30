# T076: Doc actions menu in the doc header
**Status:** ✅ Done
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

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Open /docs and open a doc → the header row ends with a ⋯ button: Rename, Move to folder, Duplicate, Copy path, Copy link, Chat about this doc, Delete
- [ ] Rename → dialog shows the new path → Rename → the doc stays open under its new name
- [ ] Rename it to the name of another doc in the same folder → the dialog shows "A file already exists…" and the other doc is untouched
- [ ] Move to folder → type notes → the doc moves to notes/ and stays open
- [ ] Duplicate → <name>-copy.md opens with the same content
- [ ] Copy link, paste it into a new tab → /docs?doc=… opens that doc
- [ ] Right-click a doc in the left list → the same menu; Delete → confirm → it disappears from the list
### Regression risk
- [ ] Clicking a doc in the list still opens it, and select mode (Copy context) still works
- [ ] Editing and saving a doc still works
