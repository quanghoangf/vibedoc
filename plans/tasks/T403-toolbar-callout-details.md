# T403: Editor toolbar inserts for callout and details
**Status:** ✅ Done
**Owner:** ai:claude
**Started:** 2026-10-07
**Done:** 2026-10-07
**Phase:** R089 — Richer markdown
**Size:** S (~1 hr)
**Depends on:** T400, T402
**Covers:** S1, S3

## Goal
The doc editor toolbar has a Callout button (inserts `> [!NOTE]` + the selection as `> ` lines) and a Details button (inserts a `<details><summary>Summary</summary>` block around the selection), so users don't need to remember the syntax.

## Context
- Epic: `plans/roadmap/R089-richer-markdown.md`
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`)". Toolbar labels live under `docs.*` (see `docs.blockquote`).
- Reuse `insertAtCursor`-style dispatch in `EditorToolbar.tsx`; icons from lucide-react.

## Scope
- [ ] `EditorToolbar.tsx`: two `ToolBtn`s after Quote; callout prefixes every selected line with `> ` under a `> [!NOTE]` line; details wraps the selection as the body (placeholder text when empty) with blank lines so markdown inside renders
- [ ] i18n: `docs.callout`, `docs.details` (en + vi)
- [ ] `e2e/richer-markdown.mjs`: open the doc in edit mode, click each button, the editor text contains the inserted syntax

**Out of scope:** a kind picker for the callout (user edits NOTE by hand), a code-tabs insert.

## Files
- `src/components/docs/EditorToolbar.tsx`, `src/i18n/docs.ts`, `e2e/richer-markdown.mjs`

## Acceptance criteria
- [ ] Both buttons insert valid GFM / HTML that the preview renders (callout, details)
- [ ] Labels translated (en + vi), `pnpm build` passes
- [ ] `e2e/richer-markdown.mjs` passes

## Verify
```bash
pnpm build && pnpm lint
BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/richer-markdown.mjs
```

## Notes
- Fixed on the way: `MarkdownEditor` read `editorRef.current.view` during render, so the toolbar got `null` until something else re-rendered and every toolbar button did nothing right after opening a doc. The view is now state set by `onCreateEditor` (also clears 3 React Compiler lint errors).

## Manual tests
_2026-10-07 — ai:claude_
### Steps
- [x] S1 — WHEN a doc contains `> [!WARNING]` followed by text → THEN VibeDoc renders a warning callout with its label, in light and dark themes
- [x] S3 — WHEN a doc contains `<details><summary>More</summary>…</details>` → THEN it renders collapsed with a styled summary row that opens on click
- [ ] Open a doc in Edit, select three lines, click Callout (speech-bubble icon) → each line gets `> `, a `> [!NOTE]` line sits on top with NOTE selected; type TIP → the preview turns teal
- [ ] Put the cursor mid-line and click Collapsible section → the block starts on its own line after a blank line, "Summary" is selected
- [ ] Switch the language to Tiếng Việt → both new toolbar tooltips are in Vietnamese
### Regression risk
- [ ] Bold / Heading / Link toolbar buttons work right after opening a doc, before typing anything
