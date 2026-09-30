# T060: Manual test report on the task + card badge
**Status:** 📋 Ready
**Phase:** R043 — Task verification & review
**Size:** M
**Depends on:** —

## Goal
When an agent finishes a task, it can attach a **manual test report**: a checklist of what the human should click through, and what they should see. The report is saved in the task file, and the card shows a badge like `🧪 0/5`. This is the thin path the rest of R043 builds on.

## Context
- Epic: `plans/roadmap/R043-task-verification-and-review.md`
- Decided: the report is **encouraged, not required**. Nothing blocks moving a task to done, with or without a report.
- Decided: the report is stored **in the task file** as a `## Manual tests` section. There is no sidecar JSON.
- Decided: each item has the steps + the expected result, and a separate group lists regression risks (old features worth re-checking). Every item is a tickable checkbox.
- Tasks without a report (all of T001–T059) show no badge. Nothing is migrated.
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches fs. Call `emitUpdate()` from the API route after a mutation, never from core. `/api/mcp` is hand-rolled JSON-RPC.

## Scope
- [ ] `src/lib/manual-tests.ts` (new, pure): `setManualTests(raw, report, actor, date)` writes or replaces the section. `parseManualTests(raw)` returns the items with `checked` and `group`, plus a total/done count
- [ ] `vibedoc_update_task`: optional `manualTests` param (markdown checklist), accepted with any status. The tool description asks agents to include it when moving a task to done or review
- [ ] `core.ts`: `saveManualTests(id, report, root, actor)`. `listTasks()` exposes `manualTests: { total, done } | null` on each task
- [ ] Board card: a `🧪 done/total` badge when a report exists. Muted while items remain, green when all are ticked
- [ ] `node src/lib/manual-tests.check.mts`: an assert-based self-check

**Out of scope:** ticking items and the summary page (T061), the Review column (T062), the skill (T063).

## Files
- `src/lib/manual-tests.ts` + `manual-tests.check.mts`: new
- `src/lib/core.ts`: `saveManualTests()`, plus the count in `listTasks()`
- `src/app/api/mcp/route.ts`: the `manualTests` param on `vibedoc_update_task`
- `TaskCard`: the badge

## Implementation notes
- Append the section at the end of the file, never inside the head meta block. The board parser reads only the contiguous `**Key:** Value` block under the H1.
- A new report **replaces** the old section, because the code changed and old ticks no longer mean anything.
- Section shape (T061 toggles checkboxes by index in it):
```md
## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open /roadmap, click "Break down" on R043 → a chat opens titled with the epic
- [ ] Answer the questions → a plan card appears with 5 tasks
### Regression risk
- [ ] Dragging a card between columns still works
```
- If the agent sends plain text lines, normalize each line to `- [ ] …` under `### Steps`.

## Acceptance criteria
- [ ] `update_task` with `manualTests` writes the section, and the card shows `🧪 0/3` live (SSE `task_updated`)
- [ ] `update_task` to done **without** `manualTests` still works, with no badge
- [ ] A second report replaces the first one
- [ ] Existing tasks parse and render unchanged
- [ ] The self-check covers: a new section, replacing a section, counting across both groups, and plain-line normalization

## Verify
```bash
node src/lib/manual-tests.check.mts
pnpm build && pnpm lint
# Fixture as in T030 (FX with R001/R002/T001/T002) and the call() helper
call vibedoc_update_task '{"taskId":"T001","status":"done","manualTests":"- [ ] Open / → board loads\n- [ ] Drag a card → it moves"}'
cat $FX/plans/tasks/T001-first.md   # ## Manual tests with 2 items
call vibedoc_update_task '{"taskId":"T002","status":"done"}'   # works, no badge
```
