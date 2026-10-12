# T521: Epic diagram: tasks and scenario coverage
**Status:** 👀 Review
**Owner:** ai:claude
**Started:** 2026-10-12
**Done:** 2026-10-12
**Phase:** R097 — Diagrams from project data
**Size:** M (2–3 hrs)
**Depends on:** T520
**Covers:** S2, S4

## Goal
Opening an epic shows its shape at a glance: its tasks (with status and dependency order) on the left, its scenarios on the right, and an edge from each task to every scenario it covers, each scenario coloured passed / failed / unproven.

## Context
- Epic: `plans/roadmap/R097-diagrams-from-project-data.md`
- Reuse T520's `item-diagrams.ts` + `<DerivedDiagram>`. Scenario status: `scenarioStatus(id, evidence)` / `coverageOf` in `src/lib/scenarios.ts`; the sheet already builds `evidence` for `<Scenarios>` (`src/components/roadmap/RoadmapItemSheet.tsx:462`) — compute once, pass to both.
- Mermaid `flowchart LR` with two subgraphs (Tasks · Scenarios); task→task dep edges inside Tasks; task→scenario edges dotted. Uncovered scenario = a red-outlined node (matches the `uncovered-scenario` drift).
- Placement: `ItemView` in RoadmapItemSheet, above `LinkedTasks`, only for epics with tasks; a "Diagram / List" toggle is not needed — the lists stay below.
- Node click: task → `onOpenTask(id)`; scenario → scroll to that scenario row in `<Scenarios>`.
- > 20 tasks: show the diagram collapsed behind "Show diagram" (`ponytail:` cap).

## Scope
- [ ] `item-diagrams.ts`: `epicGraph(epic, tasksById, evidence)` + mermaid output; check cases (coverage edges, uncovered scenario, task without covers, cancelled tasks dropped)
- [ ] RoadmapItemSheet: the diagram above the task list; i18n en + vi in `src/i18n/roadmap.ts`
- [ ] `e2e/derived-diagrams.mjs`: S2 section — epic with 3 tasks / 2 scenarios renders 5 nodes and coverage edges; clicking a task opens it; a passed scenario node has the teal class

**Out of scope:** horizon-level diagrams, editing covers from the diagram.

## Files
- `src/lib/item-diagrams.ts`, `src/lib/item-diagrams.check.mts`, `src/components/roadmap/RoadmapItemSheet.tsx`, `src/i18n/roadmap.ts`, `e2e/derived-diagrams.mjs`

## Acceptance criteria
- [ ] An epic with tasks and scenarios shows the diagram; one without scenarios shows tasks only; a horizon shows none
- [ ] Scenario colours match the chips in the Scenarios list; updates live on SSE
- [ ] Check + e2e pass; `pnpm build` ok, no new lint errors

## Verify
```bash
node src/lib/item-diagrams.check.mts
pnpm build && pnpm lint
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/derived-diagrams.mjs
```

## Manual tests
_Auto: `e2e/derived-diagrams.mjs` passed 2026-10-12 (items below marked [x] are what it proved). `item-diagrams` + `i18n` checks, `pnpm build` ok, lint 10 errors (baseline); `roadmap-epic-pane`, `scenarios`, `board-task-panel` e2e pass._

_Notes: no Tasks / Scenarios subgraph boxes and top to bottom (`flowchart TB`): in the narrow epic pane, the boxes and a left-to-right layout shrank labels unreadably. Scenarios are stadium shapes with `S…` ids instead. Derived diagrams shrink to fit only down to 75% (`DerivedDiagram` sets `min-width`), then scroll sideways; fullscreen shows them whole._
### Steps
- [x] S2 — WHEN an epic with tasks and scenarios is opened → THEN a diagram shows its tasks with status and which scenario each covers, coloured passed / failed / unproven
- [x] S4 — WHEN one of the epic's tasks changes status while the epic is open → THEN the diagram updates without a reload
- [ ] Open R095 → the diagram reads clearly in light and dark
