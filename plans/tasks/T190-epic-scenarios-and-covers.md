# T190: Epic scenarios and task **Covers:**
**Status:** 📋 Todo
**Phase:** R068 — Scenarios as acceptance tests
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
An epic can state its promise as numbered WHEN/THEN scenarios, a task can say which ones it covers, and the epic sheet shows both. Everything else in R068 reads these two things.

## Context
- Epic: `plans/roadmap/R068-scenarios-as-acceptance-tests.md`.
- Decisions: scenarios live in the epic body under `## Scenarios`; tasks link with a meta line `**Covers:** S1, S3`. No text matching.
- Naming: in `manual-tests.ts`, `Spec:` already means a Playwright `.spec.ts` file. Say "scenario" here, never "spec".
- Epic parsing: `parseRoadmapFile()` in core (meta from the head block, `body` = the rest). Task meta: `updateTaskMeta()` rewrites only H1 + meta block, so a `**Covers:**` line survives.
- Rules: pure libs never import values from each other; only `core.ts` touches fs.

## Scope
- [ ] `src/lib/scenarios.ts` (pure): parse `## Scenarios` in an epic body:
  ```
  ## Scenarios
  ### S1: Break down an epic with scenarios
  - WHEN the user breaks down an epic with three scenarios
  - THEN every scenario is covered by at least one task
  ```
  → `{ id: 'S1', name, text }[]`; ids are unique per epic, fences ignored. `parseCovers("S1, s3")` → `['S1','S3']`.
- [ ] `src/lib/scenarios.check.mts`.
- [ ] core: `RoadmapItem.scenarios`, `Task.covers`.
- [ ] Epic sheet (`RoadmapItemSheet.tsx`): a Scenarios list (id, name, WHEN/THEN), each with the tasks that cover it.
- [ ] Task panel: a "Covers" property row (`PropertyRows`), read-only chips.

**Out of scope:** seeding checklists (T191), coverage warnings (T192), evidence status (T193).

## Files
- `src/lib/scenarios.ts`, `src/lib/scenarios.check.mts`: new
- `src/lib/core.ts`
- `src/components/roadmap/RoadmapItemSheet.tsx`, `src/components/board/TaskDetailPanel.tsx`

## Acceptance criteria
- [ ] An epic with `## Scenarios` S1–S2 and a task with `**Covers:** S2` → the sheet shows S2 covered by that task, S1 by none.
- [ ] Editing the task title in the UI keeps `**Covers:**`.
- [ ] `node src/lib/scenarios.check.mts` passes.

## Verify
```bash
node src/lib/scenarios.check.mts
pnpm lint && pnpm build
```
