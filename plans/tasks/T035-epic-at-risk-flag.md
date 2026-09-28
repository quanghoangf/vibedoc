# T035: At-risk flag per epic
**Status:** ✅ Done
**Phase:** R038 — Epic & horizon progress
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
When you open `/roadmap`, every epic at risk of missing its date is flagged on the map and listed in the "need attention" panel, with the reason, so nobody has to click into epics to find trouble. This is the epic's "Done when".

## Context
- Epic: `plans/roadmap/R038-epic-and-horizon-progress.md`
- Decision: at-risk is a new `RoadmapDrift.kind` (`'at-risk'`), not a separate UI. It reuses `DriftMark` on nodes, `DriftPanel` in `RoadmapTab.tsx`, and the MCP "⚠️ Needs attention" section as they are.
- Progress and drift are derived, never stored (MEMORY.md). `src/lib/roadmap-health.ts` stays pure (no fs), because both the page and `/api/mcp` import it.
- Due dates are local calendar dates: compare them as strings and never use `new Date("YYYY-MM-DD")`. Use `dueState()` / `localToday()`.
- Tasks already parse `**Due:**` (`Task.due` in `src/lib/core.ts`), but `roadmapHealth()` only receives status today.

## Scope
- [ ] Change `roadmapHealth()` input from `taskStatus: Record<string, TaskStatus>` to `tasks: Record<string, TaskInfo>`, with `type TaskInfo = Pick<Task, 'status' | 'due'>`
- [ ] Update both callers: `health` memo in `RoadmapTab.tsx` (~line 219) and `taskStatusMap()` in `src/app/api/mcp/route.ts` (~line 418; rename it to `taskInfoMap`)
- [ ] Add the `'at-risk'` kind. It emits **one** drift per epic (items with a parent, status not `done`) when any rule below hits, and joins the reasons into the message
  - **Overdue task:** a linked task not `done`/`cancelled` whose `due` is before today → `T040 overdue since 2026-09-20`
  - **Blocked task:** a linked task with status `blocked` → `T041 blocked`
  - **No progress near due:** the epic's `dueState` is `'soon'`, and no linked task is `done` or `in-progress` (this includes an epic with no tasks) → `due 2026-10-02, nothing started`
- [ ] Message format: `R038 "Epic & horizon progress" at risk: T040 overdue since 2026-09-20; T041 blocked`
- [ ] Extend `src/lib/roadmap-health.check.mts` with one case per rule plus the negative cases below

**Out of scope:** horizon rollup (T036), task due chips on nodes (T037), the per-line MCP tag and docs (T038), burndown and velocity (excluded by the epic).

## Files
- `src/lib/roadmap-health.ts`: `TaskInfo`, the `'at-risk'` kind, the rules in `roadmapHealth()`
- `src/lib/roadmap-health.check.mts`: switch fixtures to `TaskInfo` and add at-risk asserts
- `src/components/roadmap/RoadmapTab.tsx`: pass `{status, due}` into `roadmapHealth`
- `src/app/api/mcp/route.ts`: `taskInfoMap()` for `roadmapHint` and `vibedoc_get_roadmap`

## Implementation notes
- Put the at-risk loop inside the existing per-epic loop, where `linked` (non-cancelled, known tasks) is already computed. The "no progress" rule needs the epic's `dueState`, even when `linked` is empty. Evaluate it before the `if (!linked.length) continue`.
- An epic that is itself overdue already gets `kind: 'overdue'`. The "no progress near due" rule only uses `'soon'`, so the two never duplicate. Overdue *tasks* inside an overdue epic still produce an at-risk entry, which is intended.
- No `suggestedStatus` on at-risk, so the panel shows no "→ status" button.
- `roadmapHint()` filters on `suggestedStatus`, so at-risk won't spam the hint after `vibedoc_update_task`. Keep it that way.
- Don't add react-hooks lint errors. The baseline is 16.

## Acceptance criteria
- [ ] An epic with an overdue open task shows the ⚠ on its map node, and the tooltip and panel name the task and its date
- [ ] An epic with a blocked task is flagged the same way
- [ ] An epic due within 7 days with nothing started (or no tasks) is flagged
- [ ] Epics with status `done`, epics whose overdue task is `done`/`cancelled`, and epics due soon with one task in progress are **not** flagged
- [ ] `vibedoc_get_roadmap` lists the at-risk entries under "⚠️ Needs attention"
- [ ] `node src/lib/roadmap-health.check.mts` prints `roadmap-health: ok`

## Verify
```bash
node src/lib/roadmap-health.check.mts
pnpm build && pnpm lint
# pnpm dev → http://localhost:3000/roadmap on a fixture project with: one epic whose task has **Due:** yesterday,
# one epic with a 🚫 blocked task, one epic **Due:** in 3 days with all tasks todo.
# All three show ⚠ on the map and appear in "N need attention" without clicking any node.
```
