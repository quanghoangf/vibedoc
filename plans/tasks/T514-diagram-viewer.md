# T514: Diagram viewer: fullscreen, zoom, pan, copy source
**Status:** 📋 Todo
**Phase:** R096 — Visual docs
**Size:** M (2–3 hrs)
**Depends on:** T513
**Covers:** S2

## Goal
Large diagrams squeezed into the reading column become readable: each rendered diagram gets a small hover toolbar (Fullscreen · Copy source), and fullscreen lets you zoom and pan.

## Context
- Epic: `plans/roadmap/R096-visual-docs.md`
- T513 keeps each diagram's source in `data-source`; read it from there.
- `sanitize()` in MarkdownRenderer strips `on*` attributes, so behaviour is a delegated listener hook like `useCodeTabs` (`src/components/docs/code-tabs.ts`), not inline handlers.
- Fullscreen = the existing `Dialog` from `src/components/ui/` with the SVG cloned in; zoom/pan = CSS `transform: translate() scale()` on a wrapper (wheel / +/− / 0 resets, pointer drag pans). No new dependency.
- UI text in `src/i18n/docs.ts` (en + vi) via `useT()`.

## Scope
- [ ] Pure `src/lib/zoom-pan.ts`: `zoomAt(state, factor, point)` keeps the point under the cursor, clamps scale 0.25–4; `.check.mts`
- [ ] `src/components/docs/diagram-viewer.tsx`: `useDiagramTools(containerRef, html)` adds a toolbar to each `.mermaid[data-processed]` (buttons with aria-labels; visible on hover/focus-within), and the fullscreen dialog (wheel zoom, drag pan, keys + − 0, Esc closes, "Fit" button)
- [ ] Copy source → `navigator.clipboard.writeText` of the ```mermaid fenced source; toast "Copied"
- [ ] i18n keys en + vi
- [ ] `e2e/visual-docs.mjs`: S2 section — open fullscreen, zoom with a key, drag pans (transform changes), Esc closes; Copy source puts the fence on the clipboard (grant clipboard permissions)

**Out of scope:** copy as image / rich copy (T517), editing a diagram in the viewer.

## Files
- `src/lib/zoom-pan.ts`, `src/lib/zoom-pan.check.mts`, `src/components/docs/diagram-viewer.tsx` — new
- `src/components/docs/MarkdownRenderer.tsx` (call the hook), `src/app/globals.css`, `src/i18n/docs.ts`, `e2e/visual-docs.mjs`

## Acceptance criteria
- [ ] Hover or Tab onto a diagram → Fullscreen and Copy source buttons; both work by keyboard
- [ ] Fullscreen: wheel/keys zoom around the cursor, drag pans, Fit resets, Esc closes and focus returns to the button
- [ ] Phone width: fullscreen fills the screen, pinch isn't required (+ / − buttons visible)
- [ ] Checks + e2e pass; `pnpm build` ok, no new lint errors

## Verify
```bash
node src/lib/zoom-pan.check.mts
pnpm build && pnpm lint
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/visual-docs.mjs
```

## Manual tests
### Steps
- [ ] S2 — WHEN the user opens a large diagram fullscreen → THEN they can zoom and pan it and copy its source; a diagram with a syntax error shows the error inline, not a blank box
- [ ] Vietnamese labels on the toolbar and dialog read correctly
### Regression risk
- [ ] Agent edits to the open doc still flash only the changed blocks; diagram toolbars don't duplicate after a re-render
