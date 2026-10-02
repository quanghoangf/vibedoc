# T112: Final pass, unfold cleanup, docs, e2e
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T111

## Goal
Close the second critique: one bounded verification pass across /graph and /docs, the leftover minors fixed, docs and e2e updated, snapshot closed.

## Context
- Snapshot: `.impeccable/critique/2026-10-02T06-44-54Z__src-app-app-graph-page-tsx.md` (Minor observations). Refs: polish.md (sections 4–5), craft-floor.md.

## Scope
- [ ] Unfold cleanup: removing the entrance classes re-renders 687 edges (~109ms task at +1.65s on all kinds). Avoid it: leave the classes in place after the animation (they're inert once finished) and only change them when a new entrance starts (e.g. a run-id data attribute on the wrapper drives the animation instead of per-node classes), so no mass re-render happens.
- [ ] Mobile: the selection card doesn't cover the top third (bottom sheet-style at < sm, or collapsed to one line with expand).
- [ ] Focus + hover double highlight: hover styling yields to keyboard focus.
- [ ] "/docs 192 docs" vs graph "Docs 31": make the docs page count wording accurate (e.g. "192 files · 31 docs") — check DocList source.
- [ ] One batched inspection round (1440 + 390, dark + light once, keyboard), fix in one batch, one confirm round; browser overlay detector on /graph and /docs (live-server, inject, stop, delete .impeccable/live/).
- [ ] DESIGN.md Doc Link Graph section updated for T108–T111; MEMORY.md R056 bullet; e2e extended (labels ≥9px rendered at fit, orphans shelf reachable, broken-only toolbar, hollow done, Show in graph, Tab preview).
- [ ] Close the snapshot with critique-storage close if every Priority Issue is resolved; R056 done.

## Acceptance criteria
- [ ] No long task > 50ms during or right after the entrance on the all-kinds view (measure).
- [ ] e2e passes; build passes; lint no new errors.

## Verify
```bash
node src/lib/doc-links.check.mts && node src/components/graph/force-layout.check.mts && node src/lib/shortcuts.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
```
