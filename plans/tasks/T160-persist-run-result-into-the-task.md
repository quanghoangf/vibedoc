# T160: Write the run result into the task file
**Status:** 📋 Todo
**Phase:** R061 — Run tests from VibeDoc
**Size:** S (~1 hr)
**Depends on:** T159

## Goal
A finished Run leaves the same record an agent's run does: the checklist header says `Auto: passed|failed <date>`, and the automated items whose step passed are ticked. Card badges, Needs you, the sidebar count and the evidence doc all update on their own.

## Context
- Epic: `plans/roadmap/R061-run-tests-from-vibedoc.md`
- `/work-epic` does this by hand (`skills/work-epic/SKILL.md` "Run the spec": on a pass it ticks the 🤖 items, and `autoResult` sets the header). Reuse the same core paths:
  - `saveManualTests(taskId, null, root, actor, { autoRun })` for a header-only update (see the MCP `vibedoc_update_task` case);
  - `toggleManualTest` for single items.
- Runner end event (T157): `state.state` is passed or failed, with `state.steps`. Cancelled and error runs write nothing.
- CLAUDE.md: the route calls `emitUpdate()` after the mutation; core never does.

## Scope
- [ ] Pure `ticksForRun(items, steps)` in `src/lib/evidence.ts` returns the indexes of 🤖 items whose matching step passed. Reuse `matchItems`. Add a case to `evidence.check.mts`.
- [ ] On end (passed or failed) in the run route:
  - set `autoRun: { result, date: localToday() }`;
  - tick those indexes in one write (add `setManualTestsChecked(taskId, indexes, checked, root)` to core if a multi-index write doesn't exist; `setAllManualTests` is manual-only);
  - log activity as `human` (the person pressed Run);
  - emit `task_updated`.
- [ ] A failed run doesn't untick items a human ticked. It only sets `Auto: failed`.

**Out of scope:** auto send-back on failure (R065), and a review state per item (R062).

## Files
- `src/lib/evidence.ts` + `src/lib/evidence.check.mts`: `ticksForRun`.
- `src/lib/manual-tests.ts` (+ check): a multi-index toggle, if needed.
- `src/lib/core.ts`, `src/app/api/tasks/run/route.ts`: persist on end, then `emitUpdate("task_updated", …)`.

## Acceptance criteria
- [ ] After a passed Run of T155, its task file header reads `· Auto: passed <today>`, every 🤖 item is `[x]`, and manual items are unchanged.
- [ ] After a failed Run, the header reads `Auto: failed`, the failed step's item is unticked, and Needs you and the sidebar badge count the task.
- [ ] A cancelled Run leaves the file byte-identical.
- [ ] The Evidence view shows the new run with no reload.

## Verify
```bash
node src/lib/evidence.check.mts && node src/lib/manual-tests.check.mts
pnpm lint && pnpm build
git diff plans/tasks/T155-*.md   # after a Run from the UI
```
