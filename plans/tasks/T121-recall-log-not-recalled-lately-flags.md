# T121: Recall log + "Not recalled lately" flags
**Status:** ✅ Done
**Phase:** R051 — Memory cleanup & staleness
**Size:** M
**Depends on:** T118
**Done:** 2026-10-03

## Goal
VibeDoc records when an agent last actually read each entry. The Cleanup panel then lists entries that nobody has recalled in a long time, each with a Delete action (approval plus Undo), so dead weight can be pruned.

## Context
- Epic: `plans/roadmap/R051-memory-cleanup-and-staleness.md`
- Decided: last-recalled dates live in a sidecar `memory/.recall-log.json`, `{ "E004": "2026-10-03", … }`. Don't add a meta line to the entry files and don't use the activity log, which is capped at 2000 events.
- Decided: "recalled" means the full body was fetched with `vibedoc_get_entries` (T066). Showing up in a `vibedoc_recall` list doesn't count, and neither does the `vibedoc_read_memory` index.
- `deleteEntry` / `restoreEntry` and the delete + undo routes exist (T091).
- Project rules: only `core.ts` touches the file system. Pure logic goes in `src/lib/*.ts` with a self-check.

## Scope
- [ ] `core.ts`: `markEntriesRecalled(ids, root)` and `readRecallLog(root)`
- [ ] Call `markEntriesRecalled` from the `vibedoc_get_entries` case in `/api/mcp`
- [ ] `memory-health.ts`: `findStale(entries, recallLog, today, opts?)` returns `stale` flags with `suggestion: { action: 'delete', ids: [id] }`
- [ ] Cleanup panel: a "Not recalled lately" group. Each row shows "last recalled 74 days ago" or "never recalled", plus a Delete button that reuses the existing delete route and the Undo toast
- [ ] Self-check cases

**Out of scope:** automatic deletion or decay scoring, counting views in the UI as recalls.

## Files
- `src/lib/core.ts`, `src/lib/memory-health.ts`, `src/lib/memory-health.check.mts`
- `src/app/api/mcp/route.ts`: the `vibedoc_get_entries` case
- `src/components/memory/CleanupPanel.tsx`

## Implementation notes
- Keep git churn low. Write only when a date actually changes, so at most one write per id per day. Use sorted keys, date-only values and a trailing newline. Serialize writes with `withEntryLock` so two agents don't clobber each other.
- Stale = the last recall (or, if never recalled, the entry's `updatedAt`) is older than `opts.days`, 60 by default. A brand-new entry is therefore never stale. Severity `info`, flag id `stale:E004`.
- Delete removes the entry from the log (via `deleteEntry`) so the file doesn't fill up with dead ids. Restore doesn't re-add it.
- A missing or invalid log file means an empty log.

## Acceptance criteria
- [ ] `vibedoc_get_entries { ids: ["E004"] }` writes today's date for E004 to `memory/.recall-log.json`. A second call the same day doesn't rewrite the file
- [ ] An entry updated 90 days ago and never recalled shows under "Not recalled lately". After one `vibedoc_get_entries` call it disappears
- [ ] Delete from that row removes the entry and shows the Undo toast. Undo brings it back
- [ ] The self-check covers the 60-day boundary, never-recalled entries falling back to `updatedAt`, a custom `days` value and flag ids

## Verify
```bash
node src/lib/memory-health.check.mts
pnpm typecheck && pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_entries","arguments":{"ids":["E001"]}}}'
cat memory/.recall-log.json
```

## Manual tests
_2026-10-03 — ai_
### Steps
- [ ] In a project with a knowledge entry whose **Updated:** is 90 days ago, open /memory → Cleanup → "Not recalled lately" lists it as "E00x never recalled (updated 90 days ago)"
- [ ] Have an agent call `vibedoc_get_entries { ids: ["E00x"] }` → `memory/.recall-log.json` gets today's date for it and the row disappears without a reload
- [ ] Call it again the same day → the log file is not rewritten (no git diff)
- [ ] Put an old date for another entry in the log → its row reads "last recalled N days ago"
- [ ] Click Delete on that row → entry is gone, its log line is removed, an Undo toast shows and the panel stays open
- [ ] Click Undo → the entry is back in the list and the flag returns as "never recalled"
### Regression risk
- [ ] Deleting an entry from the entry detail (⌫ / Delete button) still works with Undo
- [ ] vibedoc_read_memory's cleanup info line now also counts stale entries
