# T112: Final pass, unfold cleanup, docs, e2e
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T111
**Done:** 2026-10-02

## Goal
Close the second critique: one bounded verification pass across /graph and /docs, the leftover minors fixed, docs and e2e updated, snapshot closed.

## Context
- Snapshot: `.impeccable/critique/2026-10-02T06-44-54Z__src-app-app-graph-page-tsx.md` (Minor observations). Refs: polish.md (sections 4–5), craft-floor.md.

## Scope
- [x] Unfold cleanup: removing the entrance classes re-renders 687 edges (~109ms task at +1.65s on all kinds). Avoid it: leave the classes in place after the animation (they're inert once finished) and only change them when a new entrance starts (e.g. a run-id data attribute on the wrapper drives the animation instead of per-node classes), so no mass re-render happens.
- [x] Mobile: the selection card doesn't cover the top third (bottom sheet-style at < sm, or collapsed to one line with expand).
- [x] Focus + hover double highlight: hover styling yields to keyboard focus.
- [x] "/docs 192 docs" vs graph "Docs 31": make the docs page count wording accurate (e.g. "192 files · 31 docs") — check DocList source.
- [x] One batched inspection round (1440 + 390, dark + light once, keyboard), fix in one batch, one confirm round; browser overlay detector on /graph and /docs (live-server, inject, stop, delete .impeccable/live/).
- [x] DESIGN.md Doc Link Graph section updated for T108–T111; MEMORY.md R056 bullet; e2e extended (labels ≥9px rendered at fit, orphans shelf reachable, broken-only toolbar, hollow done, Show in graph, Tab preview).
- [x] Close the snapshot with critique-storage close if every Priority Issue is resolved; R056 done.

## Acceptance criteria
- [x] No long task > 50ms during or right after the entrance on the all-kinds view (measure).
- [x] e2e passes; build passes; lint no new errors.

## Verify
```bash
node src/lib/doc-links.check.mts && node src/components/graph/force-layout.check.mts && node src/lib/shortcuts.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
```

## Manual tests
_2026-10-02 — ai_
### Steps
- [ ] Open /graph?kinds=doc,adr,task,epic,entry and watch the load → dots unfold from the centre, edges fade in, and nothing stutters or jumps at the end (~1.7s)
- [ ] Press the Fit button (bottom-left) → the unfold plays again from the centre
- [ ] Tab to a node on /graph, then move the mouse over a different node → only the focused node keeps its halo and its linked dots lean in; the hovered one does not light up its edges
- [ ] At phone width (390px) click a node → the selected-file card sits at the bottom, beside the zoom buttons and above the Unlinked shelf; the top of the map stays clear
- [ ] Open /docs with no doc selected → the heading reads "197 files · 31 docs" (the docs count matches the Docs chip on /graph)
### Regression risk
- [ ] Drag a dot while the entrance is still playing → it stops the entrance cleanly, the dot follows the pointer and springs back on release
- [ ] Zoom out past the readable zoom on /graph with a file selected → only the selection, matches and its neighbours keep labels, on chips
