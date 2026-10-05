# T188: Send back selected findings; mark findings outdated
**Status:** 📋 Todo
**Phase:** R067 — Spec verification review
**Size:** M (2–3 hrs)
**Depends on:** T186

## Goal
The human turns findings into a fix request in one action, and stale findings stop looking current once the agent has pushed new work.

## Context
- Epic: `plans/roadmap/R067-spec-verification-review.md`.
- Send back already exists: `sendBackTask(taskId, note, root, opts)` in core, `POST /api/tasks/review`, and `vibedoc_next_task` shows the send-back note first. Reuse it; don't add a second channel.
- Findings carry the head `sha` they were made at (T186).

## Scope
- [ ] Panel: a checkbox per finding (critical + major pre-checked) and "Send back N findings" → `sendBackTask` with a note listing them (severity, criterion, message, file).
- [ ] Outdated: core compares the report's `sha` with the newest commit matching the task id; if newer commits exist, the panel greys the findings with "outdated — re-verify" and `vibedoc_get_task` says the same. No sha → never outdated.
- [ ] Add the check to `verification.check.mts` for the note formatter (pure `formatFindingsNote`).

**Out of scope:** auto send back without a human (that is R065's territory for failed runs).

## Files
- `src/lib/verification.ts`, `src/lib/verification.check.mts`
- `src/lib/core.ts`, `src/components/board/TaskDetailPanel.tsx`

## Acceptance criteria
- [ ] Select two findings → Send back → task returns to todo and `vibedoc_next_task` shows those two findings first.
- [ ] Commit again with the task id → findings show "outdated".
- [ ] Review section records the send back as today (no new format).

## Verify
```bash
node src/lib/verification.check.mts
pnpm lint && pnpm build
```
