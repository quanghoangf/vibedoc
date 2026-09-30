# T068: Related memory suggested when a task is claimed
**Status:** 📋 Ready
**Phase:** R048 — Token-cheap recall
**Size:** S
**Depends on:** T065

## Goal
When an agent claims or opens a task, it sees up to 3 entries related to that task as compact lines, so relevant conventions and gotchas turn up without the agent having to go looking.

## Context
- Epic: `plans/roadmap/R048-token-cheap-recall.md` (in scope: "entries related to the task being claimed are suggested").
- Reuses `rankEntries` / `formatCompactLine` from t1. Keyword matching only.
- `vibedoc_next_task` (T030) already returns the task's raw file followed by `roadmapHint()`. Add the suggestions after that.

## Scope
- [ ] `src/lib/recall.ts`: pure `taskQuery(task)` builds the query from the task title, the Goal section and the Phase epic title
- [ ] `core.ts`: `relatedEntries(task, root, limit = 3)`
- [ ] `/api/mcp`: add a `## Related memory` block to the `vibedoc_next_task` (on `ready`) and `vibedoc_get_task` responses
- [ ] Unit tests for `taskQuery` in `recall.check.mts`

**Out of scope:** showing suggestions in the UI, learning from which entries get fetched.

## Files
- `src/lib/recall.ts`, `src/lib/recall.check.mts`
- `src/lib/core.ts`
- `src/app/api/mcp/route.ts`: `vibedoc_next_task` and `vibedoc_get_task` cases

## Implementation notes
- Use only strong matches: drop hits with a score below 3 (at least one summary match), so unrelated tasks don't get noise.
- If nothing qualifies, leave the block out entirely. No empty heading.
- Block format: `## Related memory`, up to 3 compact lines, then `Fetch with vibedoc_get_entries`.
- Cap the task text used for the query (for example the first 500 chars of the Goal), so a huge task doesn't match everything.

## Acceptance criteria
- [ ] Claiming a task titled "SSE reconnect on project switch" suggests an existing SSE entry
- [ ] A task with no related entries shows no `Related memory` block
- [ ] At most 3 suggestions, never bodies
- [ ] `next_task` claim behaviour (atomic claim, SSE `task_updated`) is unchanged

## Verify
```bash
node src/lib/recall.check.mts
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_task","arguments":{"taskId":"T001"}}}'
```
