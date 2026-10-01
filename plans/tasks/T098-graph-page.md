# T098: /graph page: whole-repo link graph
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** L (half a day)
**Depends on:** T097

## Goal
A `/graph` page, like Obsidian's graph view, that shows how every .md file in the project links to the others. You can filter by kind, search for a file, focus on its neighbourhood, and click any node to open it.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- Decisions: a separate page `/graph` (not `/docs?view=graph`), with a sidebar item in the "Reference" group. All .md kinds are included, and kind chips default to **Docs + ADRs on** (tasks, epics and entries off).
- Data: `GET /api/docs/graph` (T093). Layout: `forceLayout()` / `neighbourhoodIds()` (T097).
- Copy from `src/components/memory/MemoryGraph.tsx`: React Flow setup, theming, the custom node, focus/dim styling (selected plus neighbours bright, others `opacity-25`, focus edges in accent colour), `VIRTUALIZE_OVER` → `onlyRenderVisibleElements`, and node click through `useOpenNode`.
- Pages that read `?view=` / `?q=` use `useSearchParams` inside `<Suspense>` (see `src/app/(app)/memory/page.tsx:24`).
- Rules: Tailwind only, no `localStorage`. The URL holds the page state.

## Scope
- [ ] `src/app/(app)/graph/page.tsx` + `src/components/graph/DocGraph.tsx`
- [ ] Sidebar: a "Graph" item in `NAV_GROUPS` "Reference" (`src/components/layout/AppSidebar.tsx:24`), with icon `Network` or `Waypoints`.
- [ ] Kind chips (Docs, ADRs, Tasks, Epics, Entries) with counts. Edges only show between visible nodes. Re-layout runs when the filter changes.
- [ ] Node size grows with degree (in + out). Orphans are shown faded. Broken-link count goes in the toolbar.
- [ ] Search box: typing highlights matches. Enter selects the first match and pans to it.
- [ ] Clicking a node selects it, dims the rest, and shows a small side card: title, path, Links to / Linked from counts, an **Open** button and a **Focus** toggle.
  - Focus shows only the 1- or 2-step neighbourhood (a depth switch), laid out again.
  - Double-click, or Open on the card, opens the file with `useOpenNode`.
- [ ] URL state: `?node=<path>&focus=1|2&kinds=doc,adr&q=` via `history.replaceState`, so a reload or a shared link shows the same view.
- [ ] Live refresh on SSE (`doc_updated` / summary change). Keep the selected node.
- [ ] Empty state: "No links between docs yet. Link docs with [text](path.md) or [[name]]."

**Out of scope:** dragging or saving positions, a local graph in the doc panel, hover previews on nodes.

## Files
- `src/app/(app)/graph/page.tsx`: new
- `src/components/graph/DocGraph.tsx`: new
- `src/components/layout/AppSidebar.tsx`: nav item
- Optional page key in `PAGE_SHORTCUTS` (`src/lib/shortcuts.ts`). If you add one, update `shortcuts.check.mts`.

## Implementation notes
- Memoise the layout on `(visible node ids, edges)`. Selection must not re-run it.
- Pass the layout positions straight into React Flow nodes, with `nodesDraggable={false}` and `fitView`. Reuse `FIT_MIN_ZOOM` behaviour from MemoryGraph.
- Labels: the H1 label, falling back to the file name. Hide labels below a zoom threshold for big graphs if the view gets noisy.

## Acceptance criteria
- [ ] /graph on this repo shows the docs and ADRs with their links. Toggling Tasks and Entries adds them.
- [ ] Clicking HLD.md dims the unrelated nodes. Focus 1 shows only HLD and its direct neighbours, Focus 2 also their neighbours.
- [ ] Open on a doc goes to /docs with it open. On a task, /board with that task. On an entry, /memory with that entry.
- [ ] Reload keeps the selection, focus, kinds and positions.
- [ ] Panning with all kinds on stays smooth. The page is reachable from the sidebar.

## Verify
```bash
pnpm build && pnpm lint
# open http://localhost:3000/graph, then /graph?node=docs/architecture/02-high-level-design/HLD.md&focus=1
```
