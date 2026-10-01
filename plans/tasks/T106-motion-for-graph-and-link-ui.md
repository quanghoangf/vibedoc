# T106: Motion for the graph and link UI
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** L (half a day)
**Depends on:** T105

## Goal
Motion explains what changed: the graph's world moves before the camera, selection ripples out by hop distance, live changes flash, cards enter and leave with an origin. All on the system's motion tokens, all with a reduced-motion path.

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md` (Motion inventory). Refs: `.claude/skills/impeccable/reference/animate.md`, `craft-floor.md`; DESIGN.md motion tokens (`--duration-fast` 120ms, `--duration-base` 180ms, `--duration-slow` 260ms, `--ease-out-soft`), Update flash keyframe, Board motion precedent; roadmap Arrange tween (420ms, `src/components/roadmap/`) is the in-repo precedent for tweening React Flow positions.
- `changedIds` from T102; layout from `forceLayout`.

## Motion thesis
- **Focal moment — selection ripple:** selecting a node lights its depth-1 neighbours and edges first, then depth-2 (Focus 2) ~60ms later; everything else dims on `--duration-base`. Nodes and edges share one timing (today nodes fade 150ms, edges snap).
- **Continuity:** relayout (filter/focus/data change) tweens node positions old→new over `--duration-slow`…420ms with `--ease-out-soft` (rAF interpolation of React Flow node positions, like Arrange); the camera fits *after* (or concurrently, same duration), never teleport-then-glide. New nodes fade/scale in from 0.6 at their target; removed ones fade out on fast.
- **Feedback:** update flash (DESIGN.md `flash`, 1.2s accent ring) on graph nodes in `changedIds` and on LinkedDocs rows whose link changed via SSE.
- **Supporting:** selected card enters with fade + 4px slide from the right (`--duration-base`), crossfades content on reselection (fast), exits on fast. Preview card: fade + scale from 98% from the anchor edge (fast), exit fade (fast) — same vocabulary as Filter/Sort popovers. Labels fade across the zoom threshold instead of snapping. Linked docs column ≥xl: grid-template-columns 0↔18rem on `--duration-base` so the prose reflow is legible.
- **Budget:** position tween runs only on relayout; above `VIRTUALIZE_OVER` nodes skip the tween (instant + fade) — note with a `ponytail:` comment.

## Scope
- [ ] Implement the thesis above; no new dependencies (CSS + rAF/WAAPI).
- [ ] Reduced motion: CSS global rule covers CSS; JS paths get `duration: 0` for fitView/setCenter, no position tween, `scrollIntoView({behavior: 'auto'})` in MarkdownRenderer; keep opacity/colour state changes (flash becomes a static 1s ring, not removed).
- [ ] Interruption: a new relayout mid-tween starts from current interpolated positions; rapid reselection doesn't stack timers.

## Acceptance criteria
- [ ] Toggling a kind chip: nodes glide to new positions, no jump; camera doesn't double-move.
- [ ] Selecting a node: neighbours + edges light together, depth-2 after depth-1; deselect reverses on fast.
- [ ] Changing a task status via MCP: its graph node and any LinkedDocs row flash once.
- [ ] Emulated `prefers-reduced-motion: reduce`: no spatial movement, state changes still visible.
- [ ] 185-node all-kinds toggle stays smooth (no long task > 100ms in the Performance trace beyond layout compute).

## Verify
```bash
pnpm build && pnpm lint
# Playwright: record a short trace / screenshots mid-tween; emulate reduced motion
```
