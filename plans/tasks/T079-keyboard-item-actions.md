# T079: Keyboard shortcuts for item actions
**Status:** 📋 Ready
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
