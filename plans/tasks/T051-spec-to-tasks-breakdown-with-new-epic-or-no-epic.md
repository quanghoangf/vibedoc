# T051: Spec → tasks in chat: breakdown with a new epic or no epic
**Status:** ✅ Done
**Phase:** R033 — AI-generated task breakdowns
**Size:** L (half day)
**Depends on:** —

## Goal
A user pastes a feature spec into the chat and gets task files. The agent proposes either a new epic plus its tasks, or loose tasks. Today a breakdown plan must target an existing epic.

## Context
- Epic: `plans/roadmap/R033-ai-generated-task-breakdowns.md`
- The R040 pipeline already does "existing epic → tasks": `src/lib/plan.ts` (pure model), `vibedoc_propose_plan` in `src/app/api/mcp/route.ts`, `src/components/chat/PlanCard.tsx`, `POST /api/plan/apply` → `core.applyPlan()`. Extend it; do not add a new plan kind or a new tool.
- Decision: a `breakdown` plan takes **exactly one of** `epic` (existing epic id), `newEpic: { title, parent, body }` (`parent` = an existing horizon id), or neither (loose tasks). Both `epic` and `newEpic` → validation error.
- Loose tasks get no `**Phase:**` line (`CreateTaskParams.phase` is already optional).
- Only `src/lib/core.ts` touches the file system. Call `emitUpdate()` after mutations in API routes, never from core.ts.

## Scope
- [ ] `plan.ts`: widen the breakdown type to `{ kind: 'breakdown'; epic?: string; newEpic?: PlanEpicDraft; tasks: PlanTask[] }`. Keep the existing-epic validation unchanged.
- [ ] `plan.ts` `validatePlan`: validate `newEpic` the same way `validateRoadmapPlan` validates an epic (title required, body is a string, parent is an existing horizon, title unique under that horizon). Reuse or extract that logic rather than copying it.
- [ ] `plan.ts` `asRenderablePlan` / `selectPlan`: accept the missing-epic and `newEpic` forms. Unchecking tasks keeps `newEpic`. If every task is unchecked, nothing gets applied.
- [ ] `core.applyPlan()`: with `newEpic`, create the epic via `createRoadmapItem` inside the existing `withTaskClaimLock` (same task→roadmap lock order as the current `updateRoadmapItem` call), then create the tasks with `phase` = the new epic and link them. With no epic, create the tasks without a phase and return `epic: null`. Add a `ponytail:` comment: not atomic, so a failure after the epic is created leaves an epic with no tasks.
- [ ] `/api/mcp`: update the `vibedoc_propose_plan` schema and description (`epic` optional, `newEpic` object). Update the result summary (`route.ts` ~line 815) so it reads "for new epic "<title>"" or "(no epic)".
- [ ] `PlanCard.tsx`: the header shows the existing epic id, "New epic: <title> (under <horizon>)", or "No epic".
- [ ] `plan.check.mts`: add cases for a valid newEpic, a valid no-epic plan, both set → error, a newEpic whose parent is an epic → error, and a duplicate title under the horizon → error.
- [ ] `skills/epic-breakdown/SKILL.md` (the bundled copy that `readPlanningSkill('breakdown')` serves): add a short "From a spec" path. When the user gives a spec instead of an epic id, ask (single-select) whether it becomes a new epic under horizon X (recommended when a horizon fits), goes under an existing epic, or stays loose tasks. Then propose with `newEpic` / `epic` / neither.

**Out of scope:** UI entry points (T052, T053) and docs pages (T054).

## Files
- `src/lib/plan.ts`: types, validation, select, renderable
- `src/lib/plan.check.mts`: new cases
- `src/lib/core.ts`: `applyPlan()` breakdown branch (~line 543)
- `src/app/api/mcp/route.ts`: `vibedoc_propose_plan` schema (~line 318) and summary (~line 815)
- `src/components/chat/PlanCard.tsx`: header for the three forms
- `skills/epic-breakdown/SKILL.md`: "From a spec" section

## Implementation notes
- `createRoadmapItemUnlocked` requires the roadmap lock. Inside `withTaskClaimLock`, call the locked `createRoadmapItem` (core.ts ~1316), as the existing path already does with `updateRoadmapItem`. Don't take the roadmap lock outside the task lock (lock-order inversion).
- `/api/plan/apply` already emits after apply. Check that it also emits `roadmap_updated` when an epic is created, so the roadmap page refreshes.

## Acceptance criteria
- [ ] In the chat, "Break down this spec into tasks: <spec>" makes the agent ask new epic / existing epic / loose, and then propose. On Accept, the files are written.
- [ ] `newEpic` form: a new `plans/roadmap/R*.md` under the chosen horizon, whose `**Tasks:**` lists the new T ids. Each task's `**Phase:**` names the new epic.
- [ ] No-epic form: task files are written with no `**Phase:**` and show on the board. No roadmap file changes.
- [ ] The existing `epic` form behaves exactly as before.
- [ ] Invalid plans (both epic and newEpic set, parent is not a horizon, duplicate title) return validation errors to the agent.
- [ ] `node src/lib/plan.check.mts` passes with the new cases.

## Verify
```bash
node src/lib/plan.check.mts
pnpm build && pnpm lint
# then in the UI chat: paste a short spec, pick "new epic", Accept, and check plans/roadmap + plans/tasks
```
