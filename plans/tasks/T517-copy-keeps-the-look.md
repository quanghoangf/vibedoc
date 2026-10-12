# T517: Copy that keeps the look
**Status:** 📋 Todo
**Phase:** R096 — Visual docs
**Size:** M (2–3 hrs)
**Depends on:** T514, T516
**Covers:** S4

## Goal
Copying a visual block or a diagram and pasting it into Google Docs, Notion, Slack or email keeps how it looks; pasting it into a code editor or an agent gives the markdown source. This is what ChatGPT's visual answers lose on copy.

## Context
- Epic: `plans/roadmap/R096-visual-docs.md`
- One `navigator.clipboard.write([new ClipboardItem({ "text/html": …, "text/plain": … })])`; diagrams add `image/png` (SVG → canvas → blob) instead of HTML, because Docs/Notion drop pasted SVG. Fallback when `ClipboardItem` is missing: `writeText` of the source.
- Paste targets ignore classes and stylesheets: the HTML must carry **inline styles** with literal colours (resolve the tokens via `getComputedStyle`, light palette — pasted docs are usually light) and tables/divs simple enough for Google Docs (a one-column `<table>` per steps block survives better than flex; check in Docs).
- Source text: each rendered block keeps its markdown source in `data-source` (add this in `md-visual-blocks.ts` renderer, raw from the tokens).
- Button: reuse T514's hover toolbar (`diagram-viewer.tsx`) for visual blocks too → "Copy" (rich) and, for diagrams, the existing "Copy source".

## Scope
- [ ] Pure `src/lib/rich-copy.ts`: `visualBlockToHtml(block, palette)` → inline-styled HTML; `.check.mts` (no `class=`, colours inlined, text escaped)
- [ ] `md-visual-blocks.ts`: `data-source` on each block (check case)
- [ ] Toolbar "Copy" on visual blocks + "Copy image" on diagrams; toast; i18n en + vi
- [ ] `e2e/visual-docs.mjs`: S4 section — Copy on a steps block → read back `text/html` (has inline styles, item titles) and `text/plain` (= the marker + list) via `navigator.clipboard.read()` with permissions granted
- [ ] Manual check in Google Docs and Notion (see Manual tests), noted in the report

**Out of scope:** rich copy of a whole page (Copy page stays markdown), export to file.

## Files
- `src/lib/rich-copy.ts`, `src/lib/rich-copy.check.mts` — new
- `src/lib/md-visual-blocks.ts`, `src/components/docs/diagram-viewer.tsx`, `src/i18n/docs.ts`, `e2e/visual-docs.mjs`

## Acceptance criteria
- [ ] Copy on a steps block → clipboard has both `text/html` and `text/plain`; the plain text is the exact markdown source
- [ ] Copy image on a diagram → `image/png` + the fenced source as text
- [ ] Browsers without `ClipboardItem` copy the source and say so
- [ ] Check + e2e pass; `pnpm build` ok, no new lint errors

## Verify
```bash
node src/lib/rich-copy.check.mts
pnpm build && pnpm lint
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/visual-docs.mjs
```

## Manual tests
### Steps
- [ ] S4 — WHEN the user copies a visual block and pastes it into Google Docs or Notion → THEN the cards keep their layout; pasted into a code editor it is the markdown source
- [ ] Copy image on a diagram, paste into Slack or Google Docs → the diagram appears as an image
