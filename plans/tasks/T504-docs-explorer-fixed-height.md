# T504: Docs explorer has a fixed height and scrolls by itself
**Status:** 👀 Review
**Phase:** R095 — UI enhancements
**Size:** S (~1 hr)
**Covers:** S1

## Goal
On /docs the explorer (lint line, search, Agent config, folder tree) scrolls away together with a long doc. It should stay put at the viewport's height, and its own list should scroll inside it, so the tree is always reachable while reading.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Likely cause: `DocsTab` sizes its row with `minHeight: "calc(100vh - 3rem)"` (`src/components/docs/DocsTab.tsx:55`), so the row grows with the doc and the page scrolls instead of the two panes. The viewer pane already has `overflow-y-auto` and the list already has a `ScrollArea` (`src/components/docs/DocList.tsx:467`); both only work once the row has a fixed height.
- Full-height pages size themselves to `100svh - 3rem` (the header), see the note in `src/components/layout/DemoBanner.tsx:14`.
- Tailwind only, no CSS-in-JS (CLAUDE.md).

## Scope
- [ ] Give the /docs row a fixed height (`100svh - 3rem`) with `overflow-hidden`, instead of a min-height
- [ ] Make sure the explorer `<aside>` is `min-h-0` and its `ScrollArea` takes the remaining height under the lint line / search / Agent config, so the tree scrolls inside it
- [ ] The doc viewer keeps scrolling in its own pane (Preview, Split, editor, API reference view)
- [ ] Phone width: the list or the doc is the page (existing `max-md:hidden` logic); each still scrolls

**Out of scope:** resizing behaviour of the explorer edge, the collapse toggle, other pages' layouts

## Files
- `src/components/docs/DocsTab.tsx` — row height
- `src/components/docs/DocList.tsx` — `<aside>` / `ScrollArea` flex sizing if needed
- `e2e/docs-explorer-scroll.mjs` — new; copy the setup of `e2e/docs-lint.mjs`

## Acceptance criteria
- [ ] Open a long doc, scroll the doc to the bottom → the explorer's top (DOCS header, search) is still visible at the same position
- [ ] With a long tree, scroll inside the explorer → the tree moves, the doc doesn't
- [ ] `document.scrollingElement.scrollTop` stays 0 on /docs (the window never scrolls)
- [ ] Split view and the editor still scroll in their own pane; outline and LinkedDocs panels unaffected
- [ ] 390px width: the list page and the doc page each scroll
- [ ] e2e covers the first three items

## Verify
```bash
pnpm build
PORT=3195 pnpm dev   # separate terminal
BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright node e2e/docs-explorer-scroll.mjs
BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright node e2e/docs-links.mjs
```

## Manual tests
### Steps
- [x] S1 — WHEN a long doc is open on /docs and the user scrolls the doc → THEN the explorer stays in place at full height and scrolls only by itself
- [ ] Open a long doc in Split → the editor (left) and the preview (right) each scroll on their own; the explorer and the doc header bar stay put
- [ ] Switch to Edit and scroll with the pointer in the empty area right of the text → the editor scrolls (the pane now fills the width)
- [ ] Open the API reference (`/docs?api=1`, needs an openapi.yaml) and scroll a long endpoint → only the right pane scrolls
- [ ] At 390px open /docs → the list scrolls; open a doc → the doc scrolls, the back arrow stays at the top
### Regression risk
- [ ] Doc outline (heading list in the bar) and the Linked docs column (≥1280px) still open and scroll; clicking an outline heading scrolls the doc to it
- [ ] Drag the explorer's edge and collapse it with ⌘\ → both still work at full height
