# T079: Keyboard shortcuts for item actions
**Status:** ✅ Done
**Phase:** R054 — Item actions
**Size:** S
**Depends on:** T074, T075, T076

## Goal
Every item action can be done from the keyboard for the selected or open item.

## Context
- Epic: `plans/roadmap/R054-item-actions.md`
- Palette: `src/components/layout/CommandPalette.tsx`; existing /board keys are listed in memory (`v` `1`–`4` `f` `n` `/`)

## Scope
- [ ] Keys for the open/selected item: `e` edit, `s` status, `⌫` delete, `d` duplicate, `c` chat
- [ ] The same actions in the command palette, scoped to the current item
- [ ] Shortcut hints shown in the ⋯ menus

## Acceptance criteria
- [ ] No new key clashes with existing shortcuts or with typing in inputs and the editor

## Verify
```bash
pnpm build && pnpm lint
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] /board: open a task panel, press ⇧E → the edit form opens; ⇧S → the ⋯ menu opens with Status; ⇧C → a chat about the task opens
- [ ] With the panel open, press ⌫ → the task is deleted and the Undo toast shows
- [ ] Open the ⋯ menus on a task, an epic and a doc → each action shows its key (⇧E, ⇧S, ⇧D, ⇧C, ⌫) on the right
- [ ] With a task panel open press ⌘K → the first group is named after the task and lists its actions with their keys; Enter runs the highlighted one
- [ ] /roadmap: open an epic, ⇧D → a copy is created and opens; ⇧E → the edit form
- [ ] /docs: open a doc, click the path in the header (not the editor), ⇧D → a copy opens. Typing a capital D in the editor just types
- [ ] Table view: tick two tasks, press ⌫ → both are deleted (Undo in the toast)
- [ ] Press ? → the help sheet has an "Open item" section with these keys
### Regression risk
- [ ] Bare letters still jump pages (e → Explorer, d → Docs, s → Settings, c → next chat) and typing in inputs is never hijacked
