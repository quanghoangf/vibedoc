# T518: Editor toolbar: insert diagrams and visual blocks
**Status:** 📋 Todo
**Phase:** R096 — Visual docs
**Size:** S (~1 hr)
**Depends on:** T513, T516
**Covers:** S5

## Goal
Starting a diagram or a visual block is one click: the doc editor toolbar gets an "Insert visual" menu with diagram templates (flowchart, sequence, state, ER) and the four visual blocks, inserted at the cursor and rendered by the live preview.

## Context
- Epic: `plans/roadmap/R096-visual-docs.md`
- `src/components/docs/EditorToolbar.tsx` already has `insertAtCursor(view, text)` and R089's Callout / Collapsible section buttons — follow them. `MarkdownEditor` keeps the CodeMirror view in state (`onCreateEditor`).
- Use the existing dropdown menu primitive in `src/components/ui/`. Menu labels in `src/i18n/docs.ts`; the inserted markdown stays English (files VibeDoc writes stay English, R078).
- Templates are small (3–5 nodes / items) so they read as a starting point.

## Scope
- [ ] Templates as a const in `EditorToolbar.tsx` (or a sibling `visual-templates.ts` if it grows past ~40 lines): flowchart, sequence, state, ER, steps, cards, compare, timeline
- [ ] "Insert visual" menu button (lucide `Shapes` or similar) with two groups (Diagram · Visual block); inserts on its own lines (adds blank lines around when needed)
- [ ] i18n en + vi
- [ ] `e2e/visual-docs.mjs`: S5 section — insert a sequence diagram and a steps block → the preview renders an `svg` and a `.md-visual[data-visual=steps]`

**Out of scope:** a visual diagram editor, custom user templates.

## Files
- `src/components/docs/EditorToolbar.tsx`, `src/i18n/docs.ts`, `e2e/visual-docs.mjs`

## Acceptance criteria
- [ ] Each of the 8 entries inserts valid source that the preview renders without an error
- [ ] Keyboard: menu opens with Enter, arrows move, Enter inserts, focus returns to the editor
- [ ] `pnpm build` ok, no new lint errors; e2e passes

## Verify
```bash
pnpm build && pnpm lint
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/visual-docs.mjs
```

## Manual tests
### Steps
- [ ] S5 — WHEN the user picks a diagram template or a visual block from the editor toolbar → THEN the source is inserted at the cursor and the live preview shows it rendered
