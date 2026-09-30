# T087: vibedoc_delete_entry + entry index at session start
**Status:** ✅ Done
**Phase:** R046 — Project knowledge entries
**Size:** M (2–3 hrs)
**Depends on:** T086
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
A convention an agent saves in one session shows up in the next session's start, and nobody has to copy it into the handoff. `vibedoc_read_memory` now ends with an index of every entry, one line each. Agents can also remove an entry that has become wrong. This task delivers the epic's "Done when".

## Context
- Epic: `plans/roadmap/R046-project-knowledge-entries.md`
- Builds on `Entry`, `listEntries()` and `withEntryLock` from T086 (`src/lib/entries.ts`, `src/lib/core.ts`).
- Decided: delete removes the file for real. Git keeps the history (R053 T072 reads it), so there is no soft delete and no Undo here. R047 owns the UI.
- Decided: the index is part of the `vibedoc_read_memory` reply, because every agent already calls it at session start. Don't add a separate tool for it.
- R048 T067 will later cap this index with a token budget. Here, list every entry. Keep the index in one function, so T067 has one place to change.
- Project rules (CLAUDE.md): only `core.ts` touches the file system. Call `emitUpdate()` in the route after a mutation.

## Scope
- [ ] `entries.ts`: `formatEntryIndex(entries: Entry[]): string`
- [ ] `entries.check.mts`: cases for `formatEntryIndex`
- [ ] `core.ts`: `deleteEntry(id, root, actor)`
- [ ] `/api/mcp`: register and handle `vibedoc_delete_entry`. `case "vibedoc_read_memory"` appends the index to the memory content

**Out of scope:** a token budget for the index (R048 T067). Fetching bodies (R048 T066). Showing entries in the Memory tab (R047). Docs and guidance text (T088).

## Files
- `src/lib/entries.ts`: add `formatEntryIndex()`
- `src/lib/entries.check.mts`: extend
- `src/lib/core.ts`: add `deleteEntry()` next to `saveEntry()`
- `src/app/api/mcp/route.ts`: the tool definition after `vibedoc_save_entry`, a new `case`, and the change in `case "vibedoc_read_memory"` (around line 800)

## Implementation notes
- The index format. Keep it short, because it loads on every session start:

  ```md
  ## Knowledge entries (3)
  E001 · convention · Only core.ts touches the file system
  E002 · gotcha · Roadmap due dates are local dates; compare as strings
  E003 · preference · Package manager is pnpm
  Save new facts with vibedoc_save_entry; pass id to update.
  ```

  No entries → `## Knowledge entries (0)` followed by the hint line, so agents learn that the tool exists.
- `vibedoc_read_memory` returns `memory.content + "\n\n" + formatEntryIndex(await listEntries(root))`. Leave `readMemory()` and `GET /api/memory` unchanged. The Memory tab shows only the file until R047.
- `deleteEntry` takes the same id normalization as T086 (`normalizeEntryId`) and runs under `withEntryLock`. An unknown id is an error. Log the `memory_updated` activity with title `Entry E001 deleted` and detail = the summary. `nextEntryId` looks only at files on disk, so deleting the highest entry (say E003) lets the next save reuse E003. Accept that; git history is per file path and the new slug differs. Say so in a one-line `ponytail:` comment.
- MCP `vibedoc_delete_entry` input: `{ id: string }`, required. Description: "Delete a knowledge entry that is wrong or no longer true. Git keeps its history." Reply: `🗑️ Deleted **E001** · <summary>`. After a delete, the route calls `emitUpdate("memory_updated", { root, entryId })`.

## Acceptance criteria
- [ ] Session 1: `vibedoc_save_entry` a convention. Session 2: `vibedoc_read_memory` → the reply ends with the index line for that entry (the epic's Done-when)
- [ ] With no `memory/entries/` folder, `vibedoc_read_memory` still works and shows `## Knowledge entries (0)` plus the hint
- [ ] `vibedoc_delete_entry { id: "e1" }` removes the file, and the entry is gone from the next `vibedoc_read_memory`
- [ ] Deleting an unknown id returns an error and touches no file
- [ ] `entries.check.mts` covers the index with 0, 1 and several entries, sorted by id

## Verify
```bash
node src/lib/entries.check.mts
pnpm build && pnpm lint   # no new lint errors beyond the 16 pre-existing react-hooks ones
M='localhost:3000/api/mcp'
curl -s $M -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_save_entry","arguments":{"type":"preference","summary":"Package manager is pnpm"}}}'
curl -s $M -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_read_memory","arguments":{}}}' | tail -c 400   # index lists the entry
curl -s $M -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_delete_entry","arguments":{"id":"E001"}}}'
curl -s $M -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_delete_entry","arguments":{"id":"E999"}}}'   # error
```
Delete any test entry files afterwards. Don't commit them.

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] From an agent, call vibedoc_read_memory in a project with no memory/entries folder → the handoff, then "## Knowledge entries (0)" and a hint to use vibedoc_save_entry
- [ ] Save an entry with vibedoc_save_entry, then start a new agent session (vibedoc_read_memory) → the reply ends with "E001 · <type> · <summary>" under "## Knowledge entries (1)", and no entry body
- [ ] Call vibedoc_delete_entry with id "e1" → "Deleted E001", the file is gone from memory/entries, and the next vibedoc_read_memory no longer lists it
- [ ] Call vibedoc_delete_entry with id "E999" → an error, and no file changes
- [ ] Open /activity → the delete shows as "Entry E001 deleted" with the summary
### Regression risk
- [ ] The Memory tab still shows only memory/MEMORY.md, and a new agent session still appears as "Session started" in /activity
