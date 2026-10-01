# T097: Deterministic force layout for the doc graph
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T093

## Goal
An Obsidian-style layout for /graph: linked files pull together into clusters and unrelated ones spread apart. It is deterministic, so a reload puts every node in the same place. This is the riskiest piece of the epic, so it comes before the page.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- Decision: write the force simulation by hand, about 60–100 lines, with **no new dependency** (no d3-force). Positions are computed per request on the client and never saved. Nothing goes to layout.json.
- The column layout in `graphLayout()` (`src/lib/memory-graph.ts`) and `arrangePositions()` (`src/components/roadmap/layout.ts`) are the existing pure-layout precedents. Both have a `.check.mts`.

## Scope
- [ ] Pure `src/components/graph/force-layout.ts`, exporting `forceLayout(nodes: {id}[], edges: {from, to}[], opts?) → Record<id, {x, y}>`:
  - Seeded start: the PRNG is seeded from a hash of the node id, or from sorted ids placed on a circle or spiral. Sort the inputs so input order does not matter.
  - Forces: link spring, pairwise repulsion (O(n²) is fine up to ~500 nodes, with a `ponytail:` note naming Barnes-Hut as the upgrade path), and a weak pull to the centre so disconnected components stay close.
  - A fixed number of iterations with cooling (for example 300). No `requestAnimationFrame`, no `Math.random`.
  - Isolated nodes form a ring around the outside, like Obsidian orphans.
- [ ] `neighbourhoodIds(edges, id, depth: 1|2)`, used by Focus in T098.
- [ ] Self-check `src/components/graph/force-layout.check.mts`.

**Out of scope:** the React page (T098), animation, drag-to-pin.

## Files
- `src/components/graph/force-layout.ts`: new, pure
- `src/components/graph/force-layout.check.mts`: new

## Implementation notes
- Seed from a string hash (FNV-1a or similar) so that adding one doc moves the others only a little, not completely.
- Normalise the output so the bounding box is centred at 0,0, and scale it so the average edge length is about 120px. React Flow's `fitView` handles the rest.
- Time it on 300 nodes / 600 edges inside the check, and keep it under about 150 ms on a laptop.

## Acceptance criteria
- [ ] The same input in shuffled order gives identical positions.
- [ ] Two cliques joined by one edge end up farther apart from each other than the nodes inside either clique.
- [ ] No two nodes are closer than a minimum distance (no overlaps) for 200 random-ish nodes.
- [ ] Isolated nodes sit outside the bounding circle of the connected nodes.
- [ ] `neighbourhoodIds` depth 1 and depth 2 are correct on a small chain graph.
- [ ] 300 nodes lay out in under ~150 ms (printed by the check).

## Verify
```bash
node src/components/graph/force-layout.check.mts
pnpm build && pnpm lint
```
