# T111: Visible keyboard model and link UI consistency
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T110
**Done:** 2026-10-02

## Goal
A sighted keyboard user can see how to drive the graph, and the link UI behaves the same on /graph and /docs.

## Context
- Snapshot: `.impeccable/critique/2026-10-02T06-44-54Z__src-app-app-graph-page-tsx.md` (P1 keyboard, P2 drift, B's LinkPreview + menu focus findings). Refs: clarify.md, polish.md, craft-floor.md.
- Code: DocGraph.tsx (HINT sr-only, card, menu, empty/error states), src/lib/shortcuts.ts (+check), src/app/(app)/layout.tsx help sheet, LinkedDocs.tsx (Flag icon for epics :64,:79; h4), DocViewer.tsx (red broken count :112), LinkPreview.tsx (capture scroll listener :151, 320px width, instant on Tab), ui/dropdown-menu.tsx item focus.

## Scope
- [ ] Selection card: a mono kbd strip "↵ open · O · ←→ linked · Esc"; search field shows a `/` kbd hint like /board.
- [ ] `?` sheet: a Graph section with every graph key (/, Tab, Enter, O, arrows, Esc, Enter/Shift+Enter for matches) from the shortcuts registry; shortcuts.check.mts updated.
- [ ] Selected node announced as selected (aria-selected/aria-pressed on the node or "selected" in its name).
- [ ] "Show in graph" from a doc: a button in the doc header and in the Linked docs column → /graph?node=<path>&focus=1.
- [ ] LinkedDocs: epics use StatusIcon (same as tasks); section headings at a level that doesn't skip (use a styled h3 or an aria-level that fits).
- [ ] Broken count muted everywhere (DocViewer button matches /graph and DESIGN.md).
- [ ] LinkPreview: opens on Tab even when the browser scrolls the link into view (ignore focus-driven scroll for ~100ms after focusin, or attach the scroll hide only after the card shows); width ≤ the column when anchored to a column row and placed to the column's left; small delay on Tab-through rows (not instant) but instant on a single deliberate focus.
- [ ] Dropdown menu items (shared ui): visible focus (≥3:1 indicator: accent ring or Graphite + accent edge), checked on the broken menu.
- [ ] No-kinds state gets a "Show docs" button; the error card keeps the toolbar usable and shows a friendly message (raw error in a details line).

## Acceptance criteria
- [ ] Keys visible in the card and the `?` sheet; `node src/lib/shortcuts.check.mts` passes.
- [ ] From /docs, Show in graph opens /graph focused on that doc.
- [ ] Tab to a below-the-fold link in /docs shows its preview.
- [ ] Menu item focus measured ≥ 3:1.

## Verify
```bash
node src/lib/shortcuts.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
```

## Manual tests
_2026-10-02 — ai_
### Steps
- [ ] On /graph click any file → the Selected file card shows a mono key strip `↵` `o` open · `←→` linked · `Esc` clear, and the empty search box shows a `/` key
- [ ] Press `?` on any page → the Keyboard shortcuts sheet has a Graph section listing /, ↵ ⇧↵, Tab, ↵, o, ←→↑↓ and Esc, and the sheet scrolls when it's taller than the window
- [ ] Open a doc in /docs and click the graph icon in its header (or Show in graph at the foot of Linked docs) → /graph opens with that doc selected and Focus 1 on
- [ ] Open a task file that links an epic in /docs → the epic row in Linked docs shows a status icon like the task rows (no flag); a doc with a broken link shows its count in grey with an unlink icon, not red
- [ ] In a long doc, put the cursor above a link that's below the fold and press Tab → the page scrolls to the link and its preview card opens and stays; tabbing quickly through Linked docs rows shows the card only once you pause, no wider than the column
- [ ] On /graph open the broken links menu with Enter and arrow down → the focused row shows a clear accent bar on its left edge; on /graph?kinds=none a Show docs button brings the docs back
### Regression risk
- [ ] Other dropdown menus (doc actions ⋯, Connect, task ⋯) still look right with the new focus edge on their items
- [ ] Hovering links in a doc's preview and in Linked docs still opens the preview after the usual delay, and scrolling the page with the wheel still closes it
