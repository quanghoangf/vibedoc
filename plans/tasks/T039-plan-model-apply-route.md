# T039: Plan model, apply route and vibedoc_propose_plan (breakdown)
**Status:** ✅ Done
**Phase:** R040 — Planning from the chat sidebar
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
An agent can propose a set of tasks for an epic with `vibedoc_propose_plan`, and `POST /api/plan/apply` writes the chosen ones as complete task files linked to the epic. This is the server half of the thin slice: after this task, the whole breakdown flow works through curl. The chat UI comes in T040.

## Context
- Epic: `plans/roadmap/R040-planning-from-the-chat-sidebar.md`
- Pattern to copy: `vibedoc_propose_edit` (`src/app/api/mcp/route.ts` ~line 638). The tool **validates only and never writes**. The UI reads the tool call's input from the chat stream and writes only after the user clicks Accept.
- Decided: one server route applies the whole plan in one call. The client never chains ids.
- Decided: the user can uncheck items before Accept, so apply takes the plan plus the list of selected keys.
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches the file system. API routes call `emitUpdate()` after mutations, never `core.ts`. `/api/mcp` stays hand-rolled JSON-RPC.
- Found while planning: `AppContext` refreshes on `task_updated` but not on `task_created` (`src/context/AppContext.tsx` ~line 109). Tasks created by another client (the agent, this route) don't show up on the board until reload. Fix it here.

## Scope
- [ ] `src/lib/plan.ts` (new, pure): plan types, `validatePlan()` and `selectPlan()`. Shapes are below. Both plan kinds are typed, but only `breakdown` is validated and applied here. T043 adds `roadmap`.
- [ ] `src/lib/plan.check.mts` (new): assert-based self-check
- [ ] `core.ts`: `createTask()` accepts an optional `body` (replaces the empty template sections) and `due`. Add `applyPlan(plan, selectedKeys, root)`.
- [ ] `src/app/api/plan/apply/route.ts` (new): `POST { plan, selected }` returns `{ created: [{ key, id, file }] }`. On validation errors it returns 400 with `{ error }`.
- [ ] MCP `vibedoc_propose_plan`: validates the plan against the current files and returns a short "📋 Proposed N tasks for R0xx. The user reviews and accepts in the UI; nothing is written yet." On invalid input it throws with the error list, so the agent can fix the plan and retry.
- [ ] `AppContext`: add `task_created` to the event types that trigger `refresh()`

**Out of scope:** the chat UI card (T040), questions (T041), the `roadmap` kind (T043), editing existing tasks.

## Files
- `src/lib/plan.ts`, `src/lib/plan.check.mts`: new
- `src/lib/core.ts`: `createTask()` (~line 441), and the new `applyPlan()`
- `src/app/api/plan/apply/route.ts`: new
- `src/app/api/mcp/route.ts`: tool definition and `case`, next to `vibedoc_propose_edit`
- `src/context/AppContext.tsx`: the refresh event list (~line 109)

## Implementation notes
Pin this shape, because T040, T041 and T043 build on it:

```ts
// src/lib/plan.ts
export interface PlanTask {
  key: string            // stable within the plan, e.g. "t1"; becomes a T id on apply
  title: string
  size?: string          // "S (~1 hr)" | "M (2–3 hrs)" | "L (half day)"
  dependsOn?: string[]   // keys in this plan, or existing task ids ("T030")
  due?: string           // YYYY-MM-DD
  body: string           // full markdown below the meta block: Goal, Context, Scope, Files, …
}
export interface PlanHorizon { key: string; title: string; body?: string }
export interface PlanEpic { key: string; title: string; parent: string; status?: RoadmapStatus; body: string } // parent: existing horizon id or a horizon key
export type Plan =
  | { kind: 'breakdown'; epic: string; tasks: PlanTask[] }
  | { kind: 'roadmap'; horizons: PlanHorizon[]; epics: PlanEpic[] }

export function validatePlan(plan: unknown, ctx: { roadmap: RoadmapItem[]; taskIds: string[] }): string[]  // [] = valid
export function selectPlan(plan: Plan, selected: string[]): { plan: Plan; errors: string[] }
```

- `validatePlan` for `breakdown`: the epic exists and has a parent (it isn't a horizon); keys are unique and non-empty; titles are non-empty; each `dependsOn` is a key in the plan or an existing task id; there are no dependency cycles; `due` is a real date (reuse the `parseDue` logic by moving it, or duplicate the 5 lines in the pure module).
- `selectPlan` drops unselected items. A selected task that depends on an unselected key is an error ("t3 depends on t2, which you unchecked"), so the user can't create a task with a dangling dependency.
- `applyPlan` (core): validate again against the current files, then create the tasks in the plan's order. Keys become real ids as they are created, so `dependsOn` keys are written as those T ids. Then append the new ids to the epic's `**Tasks:**` through `updateRoadmapItem()`, which already runs under the roadmap lock. Serialize the whole apply with `withTaskClaimLock`, so ids can't collide with a concurrent `next_task` claim or another apply.
- `createTask` with `body`: keep the meta block exactly as today (Status, Phase, Size, Depends on, plus `**Due:**` when set), then a blank line, then `body`. The phase for a breakdown is `"<epic id> — <epic title>"`, matching the tasks from `/epic-breakdown`.
- The route emits `task_created` for each created task, then `roadmap_updated` once.

## Acceptance criteria
- [ ] `vibedoc_propose_plan` with a valid breakdown returns the "nothing is written yet" text, and no file changes
- [ ] With an invalid plan (unknown epic, a horizon id, a dependency cycle, a bad dependency key) it returns `isError` listing every problem
- [ ] `POST /api/plan/apply` with 3 tasks where t2 depends on t1, selected all: creates 3 task files with sequential ids and full bodies. The t2 file says `**Depends on:** T0xx`, where T0xx is t1's new id. The epic's `**Tasks:**` line gets all 3 ids appended.
- [ ] Apply with t1 unchecked and t2 selected returns 400 "t2 depends on t1, which you unchecked" and writes nothing
- [ ] The board refreshes live when tasks are created from the API (`task_created` handled in AppContext)
- [ ] `node src/lib/plan.check.mts` covers validation, selection and cycles

## Verify
```bash
node src/lib/plan.check.mts
pnpm build && pnpm lint   # lint: no new errors beyond the 16 existing react-hooks ones

FX=$(mktemp -d) && mkdir -p $FX/plans/roadmap $FX/plans/tasks
printf '# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n' > $FX/plans/roadmap/R001-now.md
printf '# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n' > $FX/plans/roadmap/R002-epic.md
PLAN='{"kind":"breakdown","epic":"R002","tasks":[{"key":"t1","title":"First","size":"S (~1 hr)","body":"## Goal\nA"},{"key":"t2","title":"Second","dependsOn":["t1"],"body":"## Goal\nB"}]}'
curl -s "localhost:3000/api/mcp?root=$FX" -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"vibedoc_propose_plan\",\"arguments\":{\"plan\":$PLAN}}}"; echo
ls $FX/plans/tasks                                   # still empty
curl -s "localhost:3000/api/plan/apply?root=$FX" -H 'content-type: application/json' -d "{\"plan\":$PLAN,\"selected\":[\"t1\",\"t2\"]}"; echo
head -6 $FX/plans/tasks/*.md; grep Tasks $FX/plans/roadmap/R002-epic.md
```
