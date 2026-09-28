# T031: Why-nothing-ready report (finished / waiting on)
**Status:** ✅ Done
**Phase:** R037 — Agent work queue
**Size:** S (~1 hr)
**Depends on:** T030

## Goal
When `vibedoc_next_task` has nothing to hand out, the agent learns exactly why. Either the epic is finished and the agent should stop, or it names what each remaining task is waiting on. Without this, an agent in a loop can't tell "done" from "stuck".

## Context
- Epic: `plans/roadmap/R037-agent-work-queue.md`
- Builds on `pickNextTask()` / `QueueResult` from T030 (`src/lib/work-queue.ts`). Keep the result shape and fill `waiting[]`.
- Only `src/lib/core.ts` touches the file system. `work-queue.ts` stays pure.

## Scope
- [ ] `pickNextTask` fills `waiting` with one entry per task that is not done and not cancelled, in epic order
- [ ] The MCP `vibedoc_next_task` response formats `finished` and `waiting` for an agent to act on
- [ ] Extend `work-queue.check.mts` with the reason cases

**Out of scope:** automatically unblocking or reclaiming tasks. The report only describes what it finds.

## Files
- `src/lib/work-queue.ts`: reasons in `pickNextTask`
- `src/lib/work-queue.check.mts`: new asserts
- `src/app/api/mcp/route.ts`: the non-ready branches of the `vibedoc_next_task` case

## Implementation notes
Reason strings, one per remaining task. Keep them short, because agents read them:
- `in-progress`: `"T031 is in progress (claimed)"`
- `blocked`: `"T032 is blocked"`
- `todo` with unmet dependencies: `"T033 waits on T031 (in-progress), T099 (missing)"`
- A linked id with no task file: `"T040 has no task file"`

MCP text:
- `finished`: `✅ Epic R037 is finished — all N tasks done or cancelled. Stop here.` If the epic's roadmap status isn't `done`, add a nudge to call `vibedoc_update_roadmap_item { id, status: "done" }`. `roadmapHealth` in `src/lib/roadmap-health.ts` already computes this drift, so reuse it rather than recomputing.
- `waiting`: `⏳ Nothing ready in R037.` followed by the reasons as a bullet list. If every remaining task is `blocked`, or waits only on blocked or missing tasks, end with `Needs a human: unblock one of the tasks above.`

## Acceptance criteria
- [ ] All tasks done or cancelled → `finished`. The MCP text says to stop and nudges the epic status when it isn't `done` yet
- [ ] Remaining work is in progress → `waiting` names the in-progress tasks
- [ ] A chain waiting on a blocked task ends with the "Needs a human" line
- [ ] Missing task files and missing dependency ids appear in the reasons
- [ ] The self-check covers each reason string

## Verify
```bash
node src/lib/work-queue.check.mts
pnpm build && pnpm lint
# Re-use the fixture from T030's Verify, then:
call vibedoc_update_task '{"taskId":"T002","status":"blocked"}'
call vibedoc_next_task '{"epic":"R002"}'   # waiting: T002 is blocked + "Needs a human"
call vibedoc_update_task '{"taskId":"T002","status":"done"}'
call vibedoc_next_task '{"epic":"R002"}'   # finished + nudge to set R002 done
```
