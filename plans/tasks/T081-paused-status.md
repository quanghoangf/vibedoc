# T081: Paused status
**Status:** 📋 Ready
**Phase:** R055 — Item properties
**Size:** S
**Depends on:** —

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
