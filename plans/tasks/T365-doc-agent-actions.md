# T365: Doc actions for agents (menu, ⌘K, editor toolbar)
**Status:** 📋 Todo
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

## Manual tests
- [ ] S4 — WHEN the user opens ⋯ on a doc and picks Copy page or Ask agent about this doc → THEN the clipboard holds the agent view, or a chat starts that reads that doc
