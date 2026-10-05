# T164: Review marks model: flagged steps in the ## Review entry + generated send-back note
**Status:** 📋 Ready
**Phase:** R062 — Evidence-based review
**Size:** M
**Depends on:** T163

## Goal
A send back can carry per-step marks: steps the reviewer doubts, plus failed steps. Each mark is written into the `## Review` entry with the step name, run id and screenshot, so the agent knows exactly what to fix.

## Context
- Epic: `plans/roadmap/R062-evidence-based-review.md`
- Interview decision: **marks are stored only in the task's `## Review` entry**, written when the reviewer approves or sends back. There's no sidecar file and no write per click.
- `src/lib/review.ts` (pure) has `appendReviewEntry(raw, outcome, note, date)` and `latestReview(raw)`, covered by `review.check.mts` (T062).
- `/work-epic` and `vibedoc_next_task` already put the latest changes-requested note first (T063). Because the step lines live in the note body, the agent sees them without any MCP change. With the run id, the agent can call `vibedoc_get_evidence { taskId, runId }` for the screenshot.
- The evidence item/step matching is in `src/lib/evidence.ts` (`matchItems`), and the run steps and screenshot file names come from the run's `run.json` (T149/T153).

## Scope
- [ ] `src/lib/review.ts`:
  - type `ReviewMark = { item: number; step: string; kind: "doubt" | "failed"; comment?: string; screenshot?: string }`;
  - `formatSendBackNote(note, runId, marks)` builds the note body;
  - `parseReviewMarks(entryBody)` reads the marks back; `latestReview()` returns `{ …, runId?, marks }`.
- [ ] The entry shape (append-only; old entries without marks still parse):
```md
### 2026-10-12T10:00:00Z — changes requested
Run 20261012T094500Z
- ❌ Step 3 "Click Save → toast shows" — failed: Timeout waiting for toast · screenshot 03-click-save.png
- ⚠️ Step 5 "List refreshes" — doubt: the old row is still visible · screenshot 05-list.png

<free-text note>
```
- [ ] Approve with the run id writes `Run <id>` + `All N steps reviewed` in the approved entry (the review state per item = all OK).
- [ ] `POST /api/tasks/review` accepts optional `runId` and `marks`. It validates them (item index, kind) and returns 400 on bad input. Send back is allowed with an empty free-text note **if** there is at least 1 mark. `approveTask` / `sendBackTask` take the extra args.
- [ ] Cases in `review.check.mts`: format → parse round trip, entries without marks, a mark without a screenshot, quotes and pipes in step names.

**Out of scope:** the UI for marking (next task), board chips, and MCP output changes.

## Files
- `src/lib/review.ts` + `src/lib/review.check.mts`
- `src/lib/core.ts`: the `approveTask` / `sendBackTask` signatures
- `src/app/api/tasks/review/route.ts`

## Acceptance criteria
- [ ] `curl` send back with `marks: [{item:2, step:"…", kind:"doubt", comment:"…"}]` and no note → 200. The task file shows the entry above, and the task is todo.
- [ ] Send back with no note and no marks → 400. A bad mark kind → 400.
- [ ] `vibedoc_next_task` on the sent-back task shows the step lines under `⚠️ Changes requested`.
- [ ] Existing task files with old `## Review` entries parse unchanged.
- [ ] `node src/lib/review.check.mts` prints ok.

## Verify
```bash
node src/lib/review.check.mts
pnpm lint && pnpm build
curl -s localhost:3000/api/tasks/review -H 'content-type: application/json' -d '{"id":"T155","action":"send-back","runId":"<run>","marks":[{"item":1,"step":"Open evidence","kind":"doubt","comment":"wrong run shown"}]}'
```
