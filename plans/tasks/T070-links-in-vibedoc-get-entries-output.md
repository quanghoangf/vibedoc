# T070: Links in vibedoc_get_entries output
**Status:** ✅ Done
**Phase:** R053 — Memory graph
**Size:** S
**Depends on:** T069, T066
**Owner:** ai:claude-code
**Due:** 2026-10-01
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
When an agent fetches an entry, it also sees what the entry relates to (tasks, epics, docs, other entries) and what links back to it, without making another tool call.

## Context
- Epic: `plans/roadmap/R053-memory-graph.md`
- Uses `getMemoryGraph(root)` from t1. `vibedoc_get_entries` comes from T066.
- Same idea as T026, which appended `## Referenced by` to `vibedoc_read_doc` instead of adding a new tool.

## Scope
- [ ] `/api/mcp` `vibedoc_get_entries`: after each entry body, add a `Links:` line and a `Linked from:` line

**Out of scope:** links in `vibedoc_recall` compact lines (keep those cheap), a separate graph tool.

## Files
- `src/app/api/mcp/route.ts`: `vibedoc_get_entries` case

## Implementation notes
- Build the graph once per call, not once per entry.
- Format: `Links: T065, R048, docs/architecture/HLD.md` and `Linked from: T070, E014`. Leave out a line when it's empty.
- Cap each line at 10 items and add `+N more` after that, so a hub entry doesn't blow up the output.

## Acceptance criteria
- [ ] An entry with links shows both lines. An entry with none shows neither
- [ ] Hub entries are capped at 10 items per line
- [ ] T066 behaviour (order, not-found list, 20-id cap) is unchanged

## Verify
```bash
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_entries","arguments":{"ids":["E001"]}}}'
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Save an entry that mentions a task and a doc path, and add its id to another task file; ask an agent to call vibedoc_get_entries for it → after the body, a "Links: …" line (the task and the doc) and a "Linked from: …" line (the other task)
- [ ] Fetch an entry that mentions nothing and that nothing mentions → neither line appears
- [ ] Fetch an entry that mentions 12+ tasks → the Links line shows 10 ids and "+N more"
- [ ] Fetch ["E002", "E001", "E999"] → entries in that order, then "Not found: E999"
### Regression risk
- [ ] vibedoc_recall output stays one compact line per entry, with no links
