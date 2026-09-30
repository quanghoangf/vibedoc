# T073: Graph view in the Memory tab (React Flow)
**Status:** 📋 Ready
**Phase:** R053 — Memory graph
**Size:** M
**Depends on:** T069, T071

## Goal
The Memory tab has a Graph view showing entries and the tasks, epics, ADRs and docs they link to, so clusters and unlinked entries stand out. Clicking a node opens it. This covers the second half of the epic's done-when.

## Context
- Epic: `plans/roadmap/R053-memory-graph.md`
- Data: `GET /api/memory/graph` from t1.
- React Flow is already a dependency (the roadmap page, `src/components/roadmap/RoadmapTab.tsx` / `RoadmapNodes.tsx`). Copy its provider setup, theming and node styling. **Don't add a layout library.**
- Rules: Tailwind only, no `localStorage`.

## Scope
- [ ] `src/components/memory/MemoryGraph.tsx` (new)
- [ ] A List / Graph toggle in the Memory tab (R047's view)
- [ ] A deterministic layout in code: entries in a centre column, and linked items in columns by kind around them
- [ ] Clicking a node opens the entry (t3 view), task, epic or doc, using the same handlers as t3
- [ ] Selecting an entry highlights its edges and neighbours and dims everything else
- [ ] Live refresh on the Memory tab's SSE update

**Out of scope:** force-directed layout, saving node positions, filters beyond kind toggles.

## Files
- `src/components/memory/MemoryGraph.tsx`: new
- R047's Memory tab component: add the toggle

## Implementation notes
- Layout: sort entries by type, then id, and stack them vertically. Put each linked non-entry node in its kind's column, at the average y of the entries that link to it. Place entry→entry edges in the centre column.
- Entries with no links get a muted style, so gaps are visible without a separate feature.
- Keep node components small. Reuse the kind icons and the status-icon system from t3.
- With 200+ entries, check that the view still pans smoothly. If it doesn't, set `onlyRenderVisibleElements`.

## Acceptance criteria
- [ ] The graph shows the same links as the t3 panel for any entry
- [ ] Clicking a task node opens the task detail, and an entry node opens the entry
- [ ] Selecting an entry highlights its neighbours
- [ ] Entries with no links are visibly muted
- [ ] The layout is stable across reloads (no jumping)
- [ ] Stays usable with 200+ entries

## Verify
```bash
pnpm build && pnpm lint
# pnpm dev → Memory tab → Graph → click an entry → neighbours highlighted → click a linked task → task detail opens
```
