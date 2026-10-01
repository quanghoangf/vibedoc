# T107: Final polish pass, re-critique evidence and DESIGN.md
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T106

## Goal
One bounded verification pass across the whole doc-link path (desktop + mobile, dark + light, keyboard), fix what it shows in one batch, record the surface in DESIGN.md, and close the critique snapshot.

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md`. Ref: `.claude/skills/impeccable/reference/polish.md` (sections 4–5) and `craft-floor.md`.
- Run `.claude/skills/impeccable/scripts/impeccable critique-storage latest "src/app/(app)/graph/page.tsx" --json` first; keep `snapshot_file`.

## Scope
- [ ] One batched inspection round: /graph (default, all kinds, selected+focus, search, broken list), /docs with a well-linked doc (column, sheet at 390, preview, broken + stale), light theme once; mouse + keyboard. Fix everything found in one batch; at most one confirm round.
- [ ] Browser overlay detector on /graph and /docs (`impeccable live-server --background` + inject detect.js, then stop it and delete `.impeccable/live/`); fix real R056 findings, note false positives.
- [ ] Remove dead code/unused styles left by T101–T106.
- [ ] DESIGN.md: add a "Doc link graph" component section (shapes by kind, status hues, accent = selection, motion thesis, keyboard map) and a line in Do's for link UI; README Graph bullet updated if behaviour changed.
- [ ] MEMORY.md Key conventions: update the R056 bullet (stale paths, keyboard, motion).
- [ ] e2e/docs-links.mjs extended: keyboard select/open on /graph, no camera move on SSE, stale paths list.
- [ ] Close the snapshot (`critique-storage close …`) only if every Priority Issue is resolved; mark R056 done.

## Acceptance criteria
- [ ] All P0/P1/P2 issues in the snapshot are visibly resolved (list each with evidence in the task's summary).
- [ ] e2e passes; build passes; lint has no new errors.
- [ ] DESIGN.md documents the graph so a future change stays consistent.

## Verify
```bash
node src/lib/doc-links.check.mts && node src/components/graph/force-layout.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
```
