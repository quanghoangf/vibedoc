# T082: Automatic dates
**Status:** ✅ Done
**Phase:** R055 — Item properties
**Size:** M
**Depends on:** T080
**Owner:** ai:claude
**Done:** 2026-09-30

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

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Start (or let an agent claim) an M-size task with no due → its file gets **Started:** <today> and **Due:** <today + 3 days>; the card shows the due
- [ ] Start a task that already has a due you typed → the due stays as it was
- [ ] Mark a task done → **Done:** <today> is added; move it back to todo → the Done line goes away, Started stays
- [ ] Give an epic a due date, then create a task in it (New task with that epic, or a plan breakdown) → the task starts with the epic's due
- [ ] Add "tasks": { "sizeDays": { "M": 5 } } to .vibedoc/settings.json, start an M task → due is today + 5
### Regression risk
- [ ] Moving tasks between columns still works and does not touch Owner or the task body
