# T108: Graph readable at the fitted zoom
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T107
**Done:** 2026-10-02

## Goal
At the zoom /graph opens at, every visible label is readable and every node is easy to hit, on desktop and mobile. Re-critique P1: labels render ~7.2px (desktop) / ~3.9px (390px) because LABEL_NODES_OVER=40 keeps them on for small graphs; hit areas are 8–16px because HIT=24 is in flow units; orphans ring the cluster and push the fit out.

## Context
- Snapshot: `.impeccable/critique/2026-10-02T06-44-54Z__src-app-app-graph-page-tsx.md`. Refs: .claude/skills/impeccable/reference/layout.md, craft-floor.md; DESIGN.md "Doc Link Graph".
- Code: src/components/graph/DocGraph.tsx (LABEL_ZOOM, LABEL_NODES_OVER, FIT_MIN_ZOOM, HIT, fit effect, search Enter), src/components/graph/force-layout.ts (orphan ring, hiddenLabels), src/lib/doc-links.ts (docNode label fallback).

## Scope
- [ ] Labels: show a label only when it renders ≥ 9px on screen (zoom × 11 ≥ 9), except the selected node, search matches and the lit neighbourhood, which always show (with a surface backing chip when below threshold). Remove the node-count gate. Labels fade, never snap.
- [ ] Orphans: not part of the fit. Draw them as a compact "Unlinked (N)" shelf (a mono-labelled row or column at the canvas edge, not a ring that inflates the bounds) or keep them in flow space but fit to the main connected component(s) only. Pick the simplest that keeps them discoverable and clickable; document in DESIGN.md.
- [ ] Fit: bounds of linked nodes only; FIT_MIN_ZOOM tuned so a 36-node default view opens with readable labels at 1440 and the core visible at 390.
- [ ] Search: Enter fits the camera to all matches' bounds (not just centres the first); a next/prev match key (Enter / Shift+Enter cycles) with "3 of 15" in the count.
- [ ] Hit targets: ≥24 *screen* px at any zoom ≥ FIT_MIN_ZOOM (scale the invisible hit area by 1/zoom, capped so neighbours don't steal each other's clicks).
- [ ] Dot-over-label overlap at fit zoom (detector found 2): hiddenLabels also avoids other dots' boxes.
- [ ] docNode label fallback: H1, else file name — never the first prose sentence (AGENTS.md showed "See CLAUDE.md — this file mirrors…"). Add check cases.

## Acceptance criteria
- [ ] Default /graph at 1440: every shown label ≥ 9px rendered; at 390: same, with the selected/matched ones chip-backed.
- [ ] Orphans don't change the fit; they're reachable by mouse and keyboard.
- [ ] Hit area ≥ 24 screen px measured on the smallest node at fit zoom (desktop and 390).
- [ ] Search "doc" + Enter frames all matches; Enter again moves to the next match.
- [ ] `node src/lib/doc-links.check.mts`, `node src/components/graph/force-layout.check.mts` pass with new cases.

## Verify
```bash
node src/lib/doc-links.check.mts && node src/components/graph/force-layout.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
```

## Manual tests
_2026-10-02 — ai_
### Steps
- [ ] Open /graph at a desktop width (≥1440) → the map opens at full size with every label readable (11px), no ring of unlinked files around it
- [ ] Look at the bottom edge of the canvas → an "UNLINKED N" row lists the files with no link; click one → it is selected and the card shows it; click it again → it opens in /docs
- [ ] Narrow the window to phone width (~390) → the linked core fits, labels are hidden until you zoom in; select a file → its label and its direct neighbours' labels show on small surface chips, still readable (other matches show unless they collide)
- [ ] Type "doc" in Find a file… and press Enter → the camera frames every match; Enter again → "1 of N" and the first match is selected; Enter → "2 of N"; Shift+Enter → back to "1 of N"; focus stays in the search box
- [ ] Zoom out to the minimum fit and click a tiny task dot near its edge → it still selects (hit area ≥ 24px)
- [ ] Tab from the search box → focus walks the map's dots, then the Unlinked shelf buttons
### Regression risk
- [ ] Dragging a dot still springs it home and doesn't select it; the entrance unfold and live ping still play
- [ ] The AGENTS.md node and its /docs Linked panel row now read "AGENTS" instead of its first sentence; other doc titles unchanged
