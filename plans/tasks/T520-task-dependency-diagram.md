# T520: Task dependency diagram
**Status:** 👀 Review
**Owner:** ai:claude
**Started:** 2026-10-12
**Done:** 2026-10-12
**Phase:** R097 — Diagrams from project data
**Size:** L (half a day)
**Depends on:** T513
**Covers:** S1, S4

## Goal
A task shows where it sits in the work: a small left-to-right diagram of what it depends on (upstream) and what waits on it (downstream), each node with its status, clickable to open that task. It updates live when a status changes. This is the thin end-to-end slice that sets the pattern for T521/T522.

## Context
- Epic: `plans/roadmap/R097-diagrams-from-project-data.md`
- Derived on read, never stored. Data is already in AppContext `board` (every `Task` with `dependsOn`, `status`, `title`); `depIds()` in `src/lib/board-views.ts:129` parses `Depends on`. Dependents = tasks whose deps include this id.
- Render decision: generate **Mermaid source** from the data (pure) and render it with T513's themed Mermaid. One renderer and style for authored and derived diagrams; T514's fullscreen/zoom works for free; the source is text an agent could read too. Status → `classDef` per status category using the same hues as `StatusIcon` (teal done, amber review/in-progress, red blocked, grey todo); the current task is the one accent.
- Clicks: `securityLevel: "antiscript"` blocks Mermaid `click` callbacks, so put the task id in the node id (`T509`) and use a delegated click/keydown listener on the rendered SVG `g.node` → open that task (board: `?task=`; roadmap inline detail: `onOpenTask`). Give nodes `tabindex=0` + `role=link` + aria-label after render.
- Placement: in `TaskDetailBody` (`src/components/board/TaskDetailPanel.tsx`; shared by the board sheet and /roadmap's inline task detail since T508) under T509's glance rows, collapsed when the task has no deps and no dependents (render nothing). Depth: direct neighbours plus one more hop upstream, capped at 12 nodes (`+N more` node) — note the cap with `ponytail:`.
- Live: `board` refreshes on SSE `task_updated`; re-render when the generated source changes (compare strings, no flash when equal).
- A shared React `<DerivedDiagram source onNodeClick />` component (new, `src/components/shared/DerivedDiagram.tsx`) wraps MarkdownRenderer-style Mermaid rendering for non-markdown use; reuse T513's theme init (export it from where T513 put it rather than duplicating).

## Scope
- [ ] `src/lib/item-diagrams.ts` (pure): `taskNeighbourhood(id, tasks, cap)` → `{ nodes: {id,title,status,missing?}[], edges: [from,to][] , more: number }`; `toMermaid(graph, focusId)` (escape titles, truncate to ~32 chars, missing deps dashed); `.check.mts` (chain, diamond, cycle doesn't loop, missing dep, cap)
- [ ] `DerivedDiagram.tsx` + click/keyboard handling
- [ ] `TaskDetailBody`: "Dependencies" section with the diagram; i18n en + vi in `src/i18n/board.ts`
- [ ] `e2e/derived-diagrams.mjs` — new (copy setup from `e2e/board-task-panel.mjs`): T002 depends on T001, T003 on T002 → T002's panel shows 3 nodes; click T001 opens it; moving T001 to done via `POST /api/tasks` recolours its node without reload

**Out of scope:** epic diagram (T521), doc links (T522), MCP text (T523), editing deps from the diagram.

## Files
- `src/lib/item-diagrams.ts`, `src/lib/item-diagrams.check.mts`, `src/components/shared/DerivedDiagram.tsx` — new
- `src/components/board/TaskDetailPanel.tsx`, `src/i18n/board.ts`, `e2e/derived-diagrams.mjs` — new

## Acceptance criteria
- [ ] A task with deps/dependents shows the diagram on /board and in /roadmap's inline task detail; a task with none shows nothing
- [ ] Node colours follow status in light and dark; the open task is the accent; a missing dep is dashed
- [ ] Click or Enter on a node opens that task; status changes update the diagram live
- [ ] Check + e2e pass; `pnpm build` ok, no new lint errors

## Verify
```bash
node src/lib/item-diagrams.check.mts
pnpm build && pnpm lint
PORT=3189 pnpm dev   # separate terminal
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/derived-diagrams.mjs
```

## Manual tests
_Auto: `e2e/derived-diagrams.mjs` passed 2026-10-12 (items below marked [x] are what it proved). `item-diagrams` + `i18n` checks, `pnpm build` ok, lint 10 errors (baseline); `board-task-panel`, `roadmap-epic-pane`, `visual-docs`, `i18n` e2e pass._

_Notes: the diagram is generated Mermaid rendered through `MarkdownRenderer` (so T513's theme and T514's fullscreen viewer apply), in `src/components/shared/DerivedDiagram.tsx`; it sits at the top of the panel's scroll area (shared with /roadmap's inline detail) and under the properties in a task doc. Node clicks go to `/board?task=` like the Depends on chips._
### Steps
- [x] S1 — WHEN a task has `Depends on` and dependents → THEN its panel and doc show a diagram of both sides with each task's status, and clicking a node opens that task
- [x] S4 — WHEN a task changes status while its diagram is open → THEN the diagram updates without a reload
### Regression risk
- [ ] T509's glance rows (Depends on chips) and the panel resize still work
