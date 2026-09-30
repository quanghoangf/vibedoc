# T083: Custom statuses per project
**Status:** ✅ Done
**Phase:** R055 — Item properties
**Size:** L
**Depends on:** T081
**Owner:** ai:claude
**Due:** 2026-10-07
**Started:** 2026-09-30
**Done:** 2026-09-30

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

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Settings → Statuses: the seven built-ins are listed in board order; add "QA", works like review, color pink → it appears in the list with id qa
- [ ] /board: a QA column appears where QA sits in the list; drag a card onto it → the file says **Status:** 👀 Qa and the card stays in QA
- [ ] Run /work-epic on that card's epic → the agent reports it "in review — needs a human"
- [ ] Rename QA to "Quality" → the column header changes, the task file does not
- [ ] Reorder with the arrows / change a color → the board follows; built-ins can be renamed but keep their category
- [ ] Delete Quality → choose where its tasks go (e.g. Review) → the tasks move there and the column disappears
- [ ] Status filters, the table's status column, the bulk bar and the task panel's Status menu all list the custom status
### Regression risk
- [ ] A project with no statuses in .vibedoc/settings.json looks and behaves exactly as before (columns, emoji in files, agents)
