# T062: Optional Review column + approve / send back
**Status:** 📋 Ready
**Phase:** R043 — Task verification & review
**Size:** L
**Depends on:** T060

## Goal
The board gets an **optional** Review column. A task can wait there for a human, who either **Approves** it (it moves to done) or **Sends it back** with a note (it returns to the queue). Nothing forces a task through Review: moving straight to done keeps working everywhere.

## Context
- Epic: `plans/roadmap/R043-task-verification-and-review.md`
- Decided: **no gate**. `review` is just another status. Every transition (MCP, API, drag) stays allowed.
- Decided: send back sets the status to **todo** (not in-progress), so `vibedoc_next_task` can hand the task out again. Both outcomes are recorded as a `## Review` entry in the task file.
- Status line format follows the existing emoji style: `**Status:** 👀 Review`.
- Rules: only `core.ts` touches fs, `emitUpdate()` from routes after mutations, no `localStorage`, Tailwind only.

## Scope
- [ ] Add `review` to the task status type, the status parse/serialize in `core.ts` (`👀 Review`) and every status enum (API routes, the MCP `vibedoc_update_task` / `vibedoc_list_tasks` schemas). `vibedoc_list_tasks` groups REVIEW between IN-PROGRESS and BLOCKED
- [ ] Board: a Review column between In progress and Done, using the existing column component. Drag in and out works like any other column
- [ ] Core: `approveTask(id, root, note?)` and `sendBackTask(id, note, root)`. Both require status `review`. They append the review entry, then set the status to done or todo. Send back requires a non-empty note
- [ ] `POST /api/tasks/review` `{ id, action: "approve" | "send-back", note? }` → core, then `emitUpdate("task_updated")`. Returns 400 (empty note) or 409 (not in review)
- [ ] Task detail panel: for review tasks, show **Approve** / **Send back** (send back opens a textarea). If the task has a manual test report, show the `🧪 done/total` count with a link to `/manual-tests`. For any task, show the `## Review` history
- [ ] Todo cards whose latest review is `changes requested` show a "changes requested" badge

**Out of scope:** blocking done, comment threads, multiple reviewers, reviewer identity beyond `human`.

## Files
- `src/types/index.ts` (or wherever `TaskStatus` lives): add `review`
- `src/lib/core.ts`: the status mapping, `approveTask()`, `sendBackTask()`
- `src/lib/review.ts` + `review.check.mts`: new and pure. `appendReviewEntry(raw, outcome, note, date)` and `latestReview(raw)`
- `src/app/api/tasks/review/route.ts`: new
- `src/app/api/mcp/route.ts`, `src/app/api/tasks/route.ts`: enums
- `BoardTab` / `BoardColumn`, the task detail panel (from T003), `TaskCard`

## Implementation notes
- Append at the end of the file, never inside the head meta block.
- Entry shape (T063 reads the latest one):
```md
## Review
### 2026-10-01T11:00:00Z — changes requested
The plan card doesn't scroll when there are 10+ tasks.
```

## Acceptance criteria
- [ ] `update_task` → review works, and the card shows in Review live
- [ ] `update_task` → done from todo / in-progress / review still works (no gate)
- [ ] Approve → done, with `### … — approved` appended
- [ ] Send back with a note → todo, with the note appended and the card showing "changes requested"
- [ ] Send back with an empty note is blocked in the UI and returns 400. Actions on a non-review task return 409
- [ ] Existing tasks parse unchanged. `review.check.mts` covers append + latest

## Verify
```bash
node src/lib/review.check.mts
pnpm build && pnpm lint
call vibedoc_update_task '{"taskId":"T001","status":"review"}'
curl -s "localhost:3000/api/tasks/review?root=$FX" -H 'content-type: application/json' -d '{"id":"T001","action":"send-back","note":"scroll broken"}'
call vibedoc_update_task '{"taskId":"T002","status":"done"}'   # still allowed
```
