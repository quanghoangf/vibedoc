# T080: Owner / PIC on tasks, epics and docs
**Status:** 📋 Ready
**Phase:** R055 — Item properties
**Size:** M
**Depends on:** T075

## Goal
Every task, epic and doc shows who is in charge: a human, or which agent. An agent that claims a task becomes its owner automatically.

## Context
- Epic: `plans/roadmap/R055-item-properties.md`
- Task meta: `core.ts:359` and `createTask` (`core.ts:529`); roadmap meta parse near `core.ts:1292`
- Agent claim: `claimNextTask` (`core.ts:471`) and `vibedoc_update_task` in `src/app/api/mcp/route.ts`
- Docs have no meta block today

## Scope
- [ ] `**Owner:** human | ai:<agent>` in the task and epic meta block; parse into `owner`
- [ ] Set owner to the agent on claim / in-progress by an agent; set it to human on a drag in the UI only when empty
- [ ] Docs: owner derived from the last editor in the activity log, shown in the doc header (no file change)
- [ ] Owner filter and group in board views (`src/lib/board-views.ts`)

## Acceptance criteria
- [ ] `vibedoc_next_task` leaves `**Owner:** ai:claude` on the claimed task
- [ ] Filtering the board by owner works and survives a reload (URL state)

## Verify
```bash
pnpm build && pnpm lint
```
