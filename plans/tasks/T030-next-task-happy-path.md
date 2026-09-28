# T030: next_task happy path — picker + atomic claim + MCP tool
**Status:** ✅ Done
**Phase:** R037 — Agent work queue
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
An agent calls `vibedoc_next_task { epic: "R037" }` and gets the next ready task of that epic, already moved to in-progress, with its full spec in the response. This is the thin end-to-end path the rest of the epic builds on.

## Context
- Epic: `plans/roadmap/R037-agent-work-queue.md`
- An epic's tasks are its `**Tasks:**` line (`RoadmapItem.tasks`). **That order is the queue order.**
- The task's "Depends on" line is free text (e.g. `T028 (wizard skeleton must exist)`). The dependency ids are every `T\d+` in it.
- Decided: the claim is **atomic**. Picking and moving to in-progress happen inside one in-process lock, so two agents calling at the same time never get the same task.
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches the file system. `emitUpdate()` is called from the API route after a mutation, never from `core.ts`. `/api/mcp` is hand-rolled JSON-RPC, so don't add the MCP SDK.

## Scope
- [ ] `src/lib/work-queue.ts` (new, pure, no fs): `depIds()` and `pickNextTask()` (shape below)
- [ ] `src/lib/work-queue.check.mts` (new): assert-based self-check
- [ ] `core.ts`: `claimNextTask(epicId, root)` under a new task-claim mutex
- [ ] `/api/mcp`: register `vibedoc_next_task` and handle it
- [ ] `parseTaskFile()` reads meta only from the head block under the H1, as `parseRoadmapFile()` does via `roadmapMetaEnd()`. Today it scans the first 30 lines, so a `**Depends on:**` mentioned in the body overrides the real dependencies the queue relies on

**Out of scope:** detailed reasons when nothing is ready (T031: return `waiting` with an empty list for now), UI marker (T032), loop skill (T033), docs (T034), reclaiming stale in-progress tasks.

## Files
- `src/lib/work-queue.ts`: new
- `src/lib/work-queue.check.mts`: new
- `src/lib/core.ts`: add `claimNextTask()` next to `updateTaskStatus()` (~line 378)
- `src/app/api/mcp/route.ts`: add the tool definition after `vibedoc_update_task` (~line 159), and a `case` after the `vibedoc_update_task` case (~line 526)

## Implementation notes
Pin this shape, because T031 and T032 build on it:

```ts
// src/lib/work-queue.ts
import type { RoadmapItem, Task } from './core'
export type QueueTask = Pick<Task, 'id' | 'status' | 'dependsOn'>
export type QueueResult =
  | { kind: 'ready'; taskId: string }
  | { kind: 'finished' }
  | { kind: 'waiting'; waiting: { taskId: string; reason: string }[] }  // T031 fills reasons
export function depIds(dependsOn: string): string[]           // "T008, T009 (x)" → ["T008","T009"]
export function pickNextTask(epic: RoadmapItem, tasks: QueueTask[]): QueueResult
```

Rules for `pickNextTask`:
- Walk `epic.tasks` in order. The first task with status `todo` whose dependencies are all `done` or `cancelled` is `ready`.
- A dependency id with no task file counts as **not** met.
- `finished` means every linked task that exists is `done` or `cancelled`. Linked ids with no file are ignored here.
- In every other case the result is `waiting`. `in-progress` and `blocked` tasks are never handed out.

Rules for `claimNextTask(epicId, root)`:
- Copy the `withRoadmapLock` pattern (`core.ts` ~line 1165). Use a **separate** mutex, `withTaskClaimLock`, so a claim doesn't queue behind roadmap writes.
- Inside the lock: `getRoadmapItem(epicId)`. If the item has no `parent`, throw `"<id> is a horizon; pass an epic id"`. Then `listTasks(root)`, then `pickNextTask`. On `ready`, call `updateTaskStatus(id, 'in-progress', root, 'ai')`, which already writes the activity log.
- Return `{ result, task?, previousStatus? }`.

MCP case (`vibedoc_next_task`, input `{ epic: string }` required):
- On `ready`: call `emitUpdate("task_updated", …)` with the same payload as the `vibedoc_update_task` case. Return `🔨 Claimed **T0xx** <title> (now in-progress)` followed by `## <file>` and `task.raw`, so the agent doesn't need a second `get_task` call. Then append `await roadmapHint(root, id)`.
- On `finished` / `waiting`: return a one-line message for now. T031 improves it.
- Tool description, so agents know the loop: "Claim the next ready task of an epic (deps done, not taken) and move it to in-progress. Call again after marking it done."

## Acceptance criteria
- [ ] A task whose body mentions `**Depends on:** X` in its first 30 lines keeps its real head-block dependencies
- [ ] With epic tasks `[T001, T002]`, where T002 depends on T001 and both are `todo`: the first call claims T001; a second call does **not** return T002 (T001 isn't done)
- [ ] After T001 is marked done, the next call claims T002
- [ ] Passing a horizon id or an unknown id returns a JSON-RPC error with a clear message, not a crash
- [ ] Two parallel `next_task` calls on the same epic claim two different tasks, or one task and one `waiting`, never the same task
- [ ] The board updates live when a task is claimed (SSE `task_updated`)
- [ ] `node src/lib/work-queue.check.mts` covers: dependency parsing with free text, order, unmet and missing dependencies, cancelled dependency counts as met, finished, in-progress not handed out

## Verify
```bash
node src/lib/work-queue.check.mts
pnpm build && pnpm lint   # lint: no new errors beyond the 16 existing react-hooks ones

# Fixture project, so claims don't touch this repo's real tasks
FX=$(mktemp -d) && mkdir -p $FX/plans/roadmap $FX/plans/tasks
printf '# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n' > $FX/plans/roadmap/R001-now.md
printf '# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001, T002\n' > $FX/plans/roadmap/R002-epic.md
printf '# T001: First\n**Status:** 📋 Todo\n**Depends on:** —\n' > $FX/plans/tasks/T001-first.md
printf '# T002: Second\n**Status:** 📋 Todo\n**Depends on:** T001\n' > $FX/plans/tasks/T002-second.md

call() { curl -s "localhost:3000/api/mcp?root=$FX" -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}"; echo; }
call vibedoc_next_task '{"epic":"R002"}'   # claims T001
call vibedoc_next_task '{"epic":"R002"}'   # waiting (T002 needs T001)
call vibedoc_update_task '{"taskId":"T001","status":"done"}'
call vibedoc_next_task '{"epic":"R002"}'   # claims T002
call vibedoc_next_task '{"epic":"R001"}'   # error: horizon
```
