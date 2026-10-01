# T107: Final polish pass, re-critique evidence and DESIGN.md
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T106
**Done:** 2026-10-01

## Goal
One bounded verification pass across the whole doc-link path (desktop + mobile, dark + light, keyboard), fix what it shows in one batch, record the surface in DESIGN.md, and close the critique snapshot.

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md`. Ref: `.claude/skills/impeccable/reference/polish.md` (sections 4–5) and `craft-floor.md`.
- Run `.claude/skills/impeccable/scripts/impeccable critique-storage latest "src/app/(app)/graph/page.tsx" --json` first; keep `snapshot_file`.

## Scope
- [x] One batched inspection round: /graph (default, all kinds, selected+focus, search, broken list), /docs with a well-linked doc (column, sheet at 390, preview, broken + stale), light theme once; mouse + keyboard. Fix everything found in one batch; at most one confirm round.
- [x] Browser overlay detector on /graph and /docs (`impeccable live-server --background` + inject detect.js, then stop it and delete `.impeccable/live/`); fix real R056 findings, note false positives.
- [x] Remove dead code/unused styles left by T101–T106.
- [x] DESIGN.md: add a "Doc link graph" component section (shapes by kind, status hues, accent = selection, motion thesis, keyboard map) and a line in Do's for link UI; README Graph bullet updated if behaviour changed.
- [x] MEMORY.md Key conventions: update the R056 bullet (stale paths, keyboard, motion).
- [x] e2e/docs-links.mjs extended: keyboard select/open on /graph, no camera move on SSE, stale paths list.
- [x] Close the snapshot (`critique-storage close …`) only if every Priority Issue is resolved; mark R056 done.

## Acceptance criteria
- [x] All P0/P1/P2 issues in the snapshot are visibly resolved (list each with evidence in the task's summary).
- [x] e2e passes; build passes; lint has no new errors.
- [x] DESIGN.md documents the graph so a future change stays consistent.

## Verify
```bash
node src/lib/doc-links.check.mts && node src/components/graph/force-layout.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
```

## Result
Critique snapshot `2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md` closed; every Priority Issue is resolved:
- **P0 keyboard** — edges not focusable (`edgesFocusable={false}`), nodes named ("Doc Alpha, 2 links"), focus halo, `/` Tab Enter O arrows Esc (T101). Evidence: inspection Tab from search lands on a node in 1 press; e2e step 5 (`/` → Tab → Enter selects → Esc clears → Enter twice opens).
- **P1 camera yank** — live refetches keep the camera; changed nodes flash (T102, T106). Evidence: e2e step 6 (zoom in, agent moves T001 → node gets `data-changed`, viewport transform unchanged).
- **P1 colour/shape** — shape = kind, hue = `STATUS_META`, accent only for selection/match, legend, edges ≥3:1 (T103). Evidence: inspection screenshots all-kinds (teal/amber task dots, diamonds, squares) and light theme.
- **P1 counts** — visible unique counts + "+N hidden by filters", broken vs stale split, clickable list, error card with Retry (T102, T104). Evidence: e2e steps 2 and 4; inspection "4 broken · 62 stale" menu.
- **P2 preview** — underscores kept, emoji/checkboxes stripped, `StatusChip`, keyboard-only focus open (no pop on sheet autofocus), `aria-describedby` (T105). Evidence: inspection HLD row preview "R056 … In progress" chip; 390px sheet opens with no card.

This pass: fixed a React console error on every selection (edge `transition` + `transitionDelay` mixed; delay now in the shorthand), the empty state's off-system `rounded-xl`, an orphaned doc comment in LinkedDocs; e2e extended (keyboard, no camera move on SSE, Stale paths panel) and its dim check now waits for the fade. DESIGN.md gained "Doc Link Graph" + a link-UI Do. Overlay detector: /graph 47, /docs 72 — remaining hits are false positives (Label Caps 10px and 11px meta steps flagged as tiny/undersized, teal Done `StatusIcon` flagged as AI palette, Float shadow on the preview card, pre-existing sidebar `transition: width`; the Linked docs column's grid-columns tween is the intended T106 motion).

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open /graph, press `/`, then Tab → focus lands on a file node with an accent halo and its label boxed
- [ ] Press Enter, then arrow keys → the node is selected (card top right), arrows move focus to the nearest linked file; Enter again or `O` opens it in /docs
- [ ] On /graph zoom in with the + button, then have an agent move a task (`vibedoc_update_task`) with Tasks shown → that task's dot changes colour and flashes; the view does not move
- [ ] Click "N broken · M stale" in the /graph toolbar → two lists (Broken links, Stale paths); a row opens the file scrolled to that line
- [ ] Open a doc with links on /docs at a narrow (phone) width and tap the link-count button → the Linked docs sheet opens without a preview card popping up
- [ ] Switch to the light theme and select a node on /graph → selection, status hues and edges stay readable
### Regression risk
- [ ] The Linked docs column on wide /docs still opens/closes smoothly and hover previews still appear on links in the doc body
- [ ] MemoryGraph (/memory?view=graph) and the roadmap map still render (both use React Flow)
