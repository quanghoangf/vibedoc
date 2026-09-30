# T082: Automatic dates
**Status:** 📋 Ready
**Phase:** R055 — Item properties
**Size:** M
**Depends on:** T080

## Goal
Due dates are filled in without typing, and start/done dates are recorded when the status changes.

## Context
- Epic: `plans/roadmap/R055-item-properties.md`
- `createTask` (`core.ts:496`), `updateTaskStatus` (`core.ts:394`), `claimNextTask` (`core.ts:471`)
- Dates are local calendar strings, never `new Date("YYYY-MM-DD")`: use `localToday()` in `src/lib/roadmap-health.ts`

## Scope
- [ ] New task in an epic with a due date → inherits the epic's due
- [ ] When a task goes in-progress with no due → due = start + size estimate (S 1d, M 3d, L 7d; defaults in `.vibedoc/settings.json`)
- [ ] `**Started:**` / `**Done:**` stamped on status change
- [ ] A hand-set due is never overwritten

## Acceptance criteria
- [ ] A pure helper for the rules with a `.check.mts` self-check
- [ ] Claiming an M task on 2026-10-01 with no due gives `**Due:** 2026-10-04`

## Verify
```bash
pnpm build && pnpm lint
```
