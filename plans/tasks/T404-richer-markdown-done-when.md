# T404: Richer markdown Done-when end to end, close R089
**Status:** 📋 Todo
**Phase:** R089 — Richer markdown
**Size:** S (~1 hr)
**Depends on:** T401, T403
**Covers:** S1, S2, S3

## Goal
Prove the epic's Done-when on one doc: all five alerts, a pnpm/npm code group and a details block render correctly in VibeDoc and still read correctly on GitHub; then close the epic.

## Context
- Epic: `plans/roadmap/R089-richer-markdown.md`
- "Reads correctly on GitHub": GitHub renders the alert syntax natively, shows titled fences as plain consecutive code blocks and supports `<details>`. Check it with GitHub's own renderer when available (`gh api -X POST /markdown -f mode=gfm -f text=…`): the HTML has `markdown-alert-warning`, two `<pre>`, a `<details>`.

## Scope
- [ ] `e2e/richer-markdown.mjs`: a Done-when section on one doc holding every construct (each alert, the code group, details) — all render, no console errors, also at 390px width (no horizontal page overflow from the tab strip)
- [ ] Optional GitHub render check (skipped with a note when `gh` is not authenticated)
- [ ] `memory/MEMORY.md` Key conventions: one R089 bullet
- [ ] Epic `**Status:** done`

## Files
- `e2e/richer-markdown.mjs`, `memory/MEMORY.md`, `plans/roadmap/R089-richer-markdown.md`

## Acceptance criteria
- [ ] The one-doc Done-when check passes in VibeDoc
- [ ] `pnpm build`, `pnpm lint`, both checks and the e2e pass

## Verify
```bash
node src/lib/md-alerts.check.mts && node src/lib/md-code-tabs.check.mts
pnpm build && pnpm lint
BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/richer-markdown.mjs
```

## Manual tests
### Steps
- [ ] S1 — WHEN a doc contains `> [!WARNING]` followed by text → THEN VibeDoc renders a warning callout with its label, in light and dark themes
- [ ] S2 — WHEN a doc has two fences in a row titled "pnpm" and "npm" → THEN they render as one block with two tabs, switchable by click and arrow keys
- [ ] S3 — WHEN a doc contains `<details><summary>More</summary>…</details>` → THEN it renders collapsed with a styled summary row that opens on click
