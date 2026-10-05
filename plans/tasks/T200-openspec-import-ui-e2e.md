# T200: "Import from OpenSpec" on /roadmap, e2e and docs
**Status:** 📋 Todo
**Phase:** R070 — OpenSpec import
**Size:** M (2–3 hrs)
**Depends on:** T199

## Goal
A user who opens an OpenSpec repo in VibeDoc sees an import offer, previews it, and lands on a roadmap with its changes as epics.

## Context
- Epic: `plans/roadmap/R070-openspec-import.md`. "Done when": pointing VibeDoc at the OpenSpec repo itself shows its open changes as epics with tasks and its specs in /docs.
- /roadmap already has an empty-state "Generate roadmap" flow (`generateRoadmap()`, `RoadmapTab.tsx`); put the import button next to the toolbar actions, and in the empty state when `openspec/` exists.
- Routes call core and `emitUpdate()`; never `fs` in a route.

## Scope
- [ ] `GET /api/roadmap/openspec` (detect + preview) and `POST /api/roadmap/openspec { horizon }` (apply).
- [ ] Button "Import from OpenSpec" shown only when `openspec/` exists → dialog: horizon select, preview table (epics, tasks, specs, skipped with reason) → Import → toast with counts.
- [ ] `e2e/openspec-import.mjs`: temp project with the T198 fixture → button visible → preview → import → epics on the map, a spec in /docs → import again → nothing new.
- [ ] Docs: CLAUDE.md "VibeDoc writes" (imported epics/tasks/specs, never `openspec/`), MEMORY.md conventions line, README feature list.
- [ ] Manual test: run against a local clone of github.com/Fission-AI/OpenSpec. Mark R070 done when the "Done when" holds.

## Files
- `src/app/api/roadmap/openspec/route.ts`: new
- `src/components/roadmap/RoadmapTab.tsx` (+ a dialog component)
- `e2e/openspec-import.mjs`: new
- `CLAUDE.md`, `memory/MEMORY.md`, `README.md`

## Acceptance criteria
- [ ] `node e2e/openspec-import.mjs` passes.
- [ ] The button never shows in a repo without `openspec/`.

## Verify
```bash
node src/lib/openspec.check.mts
pnpm lint && pnpm build
node e2e/openspec-import.mjs
```
