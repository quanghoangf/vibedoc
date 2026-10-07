# T365: Doc actions for agents (menu, ⌘K, editor toolbar)
**Status:** ✅ Done
**Owner:** ai:claude-code
**Done:** 2026-10-07
**Phase:** R087 — Agent-ready docs
**Size:** M (2–3 hrs)
**Depends on:** T361
**Covers:** S4

## Goal
From a doc's ⋯ menu and ⌘K: Copy page (agent view), View as Markdown, Copy agent link, Ask agent about this doc. The editor toolbar inserts an agent-only note and a human-only block.

## Context
- Epic: `plans/roadmap/R087-agent-ready-docs.md`
- "Ask agent about this doc" already exists as `docActions.chat` in `src/app/(app)/docs/page.tsx` (`askAgent(...)`); relabel it and make its message name `vibedoc_read_doc`, don't build it twice.
- Decided for ⌘K: `ItemCommand.action` becomes optional (`action?: ItemAction`) with an `id`; keyless commands show in ⌘K without a kbd and never bind a key, so `ITEM_KEYS` / `shortcuts.check.mts` stay as they are.
- UI text in `src/i18n/docs.ts` (en + vi), read with `useT()`.

## Scope
- [ ] `DocActions` gains `copyPage`, `viewMarkdown`, `copyAgentLink`; docs page implements them: Copy page fetches the doc and copies `forAgent(content)`; View as Markdown opens `/md/<path>` (with `?root=` when set) in a new tab; Copy agent link copies `origin + /md/<path>`.
- [ ] Menu items in `DocMenuItems`; ⌘K entries via `useItemCommands` in `DocViewer`.
- [ ] `EditorToolbar`: two buttons inserting `<!-- agent-only\n\n-->` and `<!-- human-only:start -->\n\n<!-- human-only:end -->` (wrapping a selection).
- [ ] Browser part of `e2e/agent-ready-docs.mjs`: ⋯ → Copy page puts the agent view on the clipboard; Ask agent starts a chat naming the doc (stubChat).

## Files
- `src/components/docs/DocActionsMenu.tsx`, `src/components/docs/DocViewer.tsx`, `src/app/(app)/docs/page.tsx`, `src/components/shared/item-commands.ts`, `src/components/layout/CommandPalette.tsx`, `src/components/docs/EditorToolbar.tsx`, `src/i18n/docs.ts`, `e2e/agent-ready-docs.mjs`

## Acceptance criteria
- [ ] Copy page → clipboard has the agent view (human-only removed)
- [ ] ⌘K on an open doc lists the four actions
- [ ] `node src/lib/i18n.check.mts` and `node src/lib/shortcuts.check.mts` pass

## Verify
```bash
node src/lib/i18n.check.mts && node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3187 PW_DIR=. node e2e/agent-ready-docs.mjs
```

## Notes
- The existing "Chat about this doc" is now "Ask agent about this doc" (same action, ⇧C); its message asks the agent to read the doc with `vibedoc_read_doc`.
- `ItemCommand.action` is optional: commands with only an `id` show in ⌘K without a key.

## Manual tests
_2026-10-07 — ai · e2e: `e2e/agent-ready-docs.mjs` (passed)_
### Steps
- [x] S4 — Open a doc with a human-only block, ⋯ → Copy page → toast "Copied the page as an agent reads it"; paste → no human-only text, agent notes in plain text
- [x] ⋯ → View as Markdown → a new tab shows the raw markdown at /md/<path>
- [x] ⋯ → Copy agent link → the clipboard holds http://…/md/<path>
- [x] S4 — ⋯ → Ask agent about this doc → a new chat starts and the agent reads that doc
- [x] ⌘K on an open doc → Copy page, View as Markdown, Copy agent link, Ask agent about this doc are listed
- [x] Edit mode, select a line, click the Bot / User toolbar buttons → the line is wrapped in `<!-- agent-only … -->` / `<!-- human-only:start/end -->`
- [ ] The two new toolbar icons read clearly next to the others (tooltips "Agent-only note", "Human-only block"), en and vi
### Regression risk
- [ ] Right-click a doc in the list → the menu still has Rename, Move, Duplicate, Delete and they still work
