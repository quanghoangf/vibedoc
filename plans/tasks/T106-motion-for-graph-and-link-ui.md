# T106: Motion for the graph and link UI
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** L (half a day)
**Depends on:** T105
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-01
**Done:** 2026-10-01

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
- [x] Implement the thesis above; no new dependencies (CSS + rAF/WAAPI).
- [x] Reduced motion: CSS global rule covers CSS; JS paths get `duration: 0` for fitView/setCenter, no position tween, `scrollIntoView({behavior: 'auto'})` in MarkdownRenderer; keep opacity/colour state changes (flash becomes a static 1s ring, not removed).
- [x] Interruption: a new relayout mid-tween starts from current interpolated positions; rapid reselection doesn't stack timers.

**Notes:** nodes now carry `measured: {width, height}` — without it every fresh node object (each restyle, each tween frame) was hidden with its edges until React Flow re-measured. `graphChanges` now also marks status changes, so an agent moving a task flashes its node. Camera fits the target layout with `getViewportForBounds` + `setViewport` on the same 420ms ease as the dots. Removed nodes fade out as short-lived ghost nodes (not focusable, no pointer events). Reduced motion: no tween, `duration: 0` camera, `scrollIntoView` auto, flash = static 1s ring (`flash-still`).

## Acceptance criteria
- [x] Toggling a kind chip: nodes glide to new positions, no jump; camera doesn't double-move.
- [x] Selecting a node: neighbours + edges light together, depth-2 after depth-1; deselect reverses on fast.
- [x] Changing a task status via MCP: its graph node and any LinkedDocs row flash once.
- [x] Emulated `prefers-reduced-motion: reduce`: no spatial movement, state changes still visible.
- [x] 185-node all-kinds toggle stays smooth (no long task > 100ms in the Performance trace beyond layout compute).

## Verify
```bash
pnpm build && pnpm lint
# Playwright: record a short trace / screenshots mid-tween; emulate reduced motion
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open `/graph`, toggle the Epics chip on and off → dots glide to their new places over ~0.4s while the camera reframes at the same time; new epics scale in, removed ones fade out, no jump
- [ ] Click a doc with links, then press Focus `2` → the node gets its ring and its edges turn accent together; the outer ring of neighbours lights a beat after the first; click the empty canvas → everything returns quickly
- [ ] With `/graph?kinds=task,epic` open, move a task via MCP `vibedoc_update_task` → that task's dot flashes an accent ring once; on `/docs` with the epic open, its Linked docs row flashes once too
- [ ] Select a node, then select another, then clear → the card slides in from the right, its content crossfades on reselect, it fades out on clear
- [ ] On `/docs` (≥1280px) hover a Linked docs row → the preview fades and grows from its corner; move away → it fades out; toggle the links button in the doc bar → the column slides between 0 and 18rem
- [ ] Turn on Reduce motion in the OS and repeat steps 1 and 3 → dots and camera jump without gliding; the flash is a steady ring for about a second
### Regression risk
- [ ] `/graph` keyboard path (Tab, arrows, Enter, Esc) and a 185-node all-kinds graph still feel responsive
- [ ] Clicking a broken / stale row in Linked docs still scrolls the doc to the link and flashes it
