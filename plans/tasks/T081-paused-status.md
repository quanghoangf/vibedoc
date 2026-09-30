# T081: Paused status
**Status:** ✅ Done
**Phase:** R055 — Item properties
**Size:** S
**Depends on:** —
**Owner:** ai:claude

## Goal
Tasks and epics can be Paused: work stopped on purpose, which is different from blocked.

## Context
- Epic: `plans/roadmap/R055-item-properties.md`
- `TaskStatus` at `core.ts:21`, `STATUS_ALIASES` at `core.ts:108`, emoji strip at `core.ts:118`
- `RoadmapStatus` / `ROADMAP_STATUSES` at `core.ts:1168`, `1207`
- Board columns and status icons: `src/components/board/views/BoardView.tsx`, `src/components/chat/StatusMarker.tsx`
- Derived health: `src/lib/roadmap-health.ts` (self-check `node src/lib/roadmap-health.check.mts`)

## Scope
- [ ] Add `paused` to both status sets, with an icon and an alias (`on hold`)
- [ ] Paused column on the board (collapsed by default)
- [ ] `vibedoc_next_task` skips paused tasks; a paused task is not a met dependency; at-risk ignores paused epics

## Acceptance criteria
- [ ] `node src/lib/roadmap-health.check.mts` passes with a paused case added

## Verify
```bash
pnpm build && pnpm lint
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] /board: open a todo or in-progress task → "pause" → the task file says **Status:** ⏸️ Paused and the card moves to the Paused column
- [ ] The Paused column sits collapsed next to Done ("N paused" + the IDs); its chevron expands it to show the cards
- [ ] Open a paused task → "start" resumes it, "backlog" sends it to todo
- [ ] A task file with **Status:** On hold shows as paused
- [ ] Run /work-epic on an epic whose next task is paused → the agent stops with "T0xx is paused — needs a human to resume it"
- [ ] /roadmap: right-click an epic → Status ▸ Paused → the node dims, the stats show "1 paused", and no "need attention" nudge appears for it
### Regression risk
- [ ] Blocked, review and done columns and drag-and-drop between them still work; Done still collapses/expands
