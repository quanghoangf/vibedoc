# T217: Board in Vietnamese: views, cards and the task panel
**Status:** 📋 Todo
**Phase:** R078 — i18n support
**Size:** L (half a day)
**Depends on:** T215
**Covers:** S1

## Goal
With Tiếng Việt chosen, every piece of interface text in this area is Vietnamese: headings, buttons, menus, dialogs, empty states, toasts, tooltips, `aria-label`s and placeholders. English looks exactly as it does today.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Pattern from T215: messages in `src/i18n/board.ts` (`en` as const + `vi: Messages<typeof en>`), registered in `src/i18n/index.ts`, read with `useT()` from `src/context/LanguageContext.tsx`. A missing `vi` key fails the build.
- Not translated: user content (doc text, task/epic titles, entry bodies, custom status names), file paths, ids (T215, R078, E012), keyboard keys, "VibeDoc", and anything MCP or the agent writes.
- Pure libs return English that MCP also uses; map their id/kind to a `t()` key in the component, don't translate inside the lib.
- CLAUDE.md: "No hardcoded UI text in components" (added by T215).

## Scope
- [ ] Create `src/i18n/board.ts` and register it
- [ ] Replace the hardcoded text in the files below with `t()` (counts and plurals via `plural()`, values via `{placeholders}`)
- [ ] Add /board (all four views) and the task panel to `PAGES` in `e2e/i18n.mjs`, opening the panels/dialogs listed in Implementation notes so their text is checked too
- [ ] Natural Vietnamese, not word-for-word: short labels for buttons; keep the established terms consistent with `src/i18n/shell.ts`

**Out of scope:** other pages; dates/numbers (T216); help/shortcut text and ⌘K commands (T223).

## Files
- `src/components/board/*.tsx`: BoardTab, BulkBar, NewTaskModal, TaskCard, TaskDetailPanel, TaskFields, TaskRuns, TaskSessions
- `src/components/board/views/*.tsx`: BoardView, EpicView, TableView, TimelineView, ViewBar, ViewToolbar
- `src/components/shared/`: ItemPanelHeader, InlineProperty, PriorityBadge, OwnerChip, StatusIcon, EmptyState (shared, but the board uses them first)

## Implementation notes
- Built-in status labels (Todo, In progress, Review, Paused, …) come from `src/lib/statuses.ts` / `components/shared/status-defs.ts`. Translate the built-in ids via `t('board.status.<id>')`; a custom status keeps its own label.
- Open in the e2e: each view (`?view=`), a task panel, the New task modal, the bulk bar (select 2 cards), saved-view menu.
- Column and group headers come from the filter/group logic in `src/lib/board-views.ts`; map the group key, not the string.

## Acceptance criteria
- [ ] In vi, /board (all four views) and the task panel show no English interface text (`e2e/i18n.mjs` passes for them)
- [ ] In en, the area is unchanged; existing e2e scripts that select by English text still pass
- [ ] `node src/lib/i18n.check.mts` passes (placeholders match)

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
- [ ] S1 — WHEN the app is in Vietnamese and the user opens /board (all four views) and the task panel → THEN every interface text is Vietnamese
