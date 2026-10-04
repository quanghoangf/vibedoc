# T130: vibedoc_export_memory: managed entries block in AGENTS.md / CLAUDE.md
**Status:** ✅ Done
**Phase:** R052 — Cross-agent memory
**Size:** M
**Depends on:** T128

## Goal
`vibedoc_export_memory` writes the project's knowledge entries into a managed block in `AGENTS.md`, and in `CLAUDE.md` when that file exists, so that Cursor, Codex and other agents that read those files see the same conventions as Claude Code. This is the epic's "a Cursor session sees the same conventions" path, because Cursor reads `AGENTS.md`.

## Context
- Epic: `plans/roadmap/R052-cross-agent-memory.md`
- Decided (interview): export writes only a **managed block** between markers and leaves the rest of the file byte-for-byte untouched. There are no separate `.cursor/rules` or `.clinerules` files.
- Decided: `AGENTS.md` is created when it is missing. `CLAUDE.md` is written only when it already exists, because creating it changes how Claude Code treats the project.
- Today DATA.md lists `CLAUDE.md` / `AGENTS.md` as "read, never modified". That changes with this task, and T131 updates the docs.
- Project rules: only `core.ts` touches the file system, and `emitUpdate()` is called in the route.

## Scope
- [x] `src/lib/entries-export.ts` (new, pure): `renderEntriesBlock(entries)` and `upsertManagedBlock(fileText, block)`
- [x] `src/lib/entries-export.check.mts` (new)
- [x] `core.ts`: `exportEntries(root, actor)` → `{ file, changed }[]`; it writes a file only when its text changed
- [x] `/api/mcp`: register and handle `vibedoc_export_memory` (no arguments)
- [x] Activity: a `doc_updated` event per changed file

**Out of scope:** automatic export after every `vibedoc_save_entry` (no live sync in this epic). Choosing which entries or types to export. Cursor `.mdc` and `.clinerules` targets.

## Files
- `src/lib/entries-export.ts`, `src/lib/entries-export.check.mts`: new
- `src/lib/core.ts`: `exportEntries()`
- `src/app/api/mcp/route.ts`: the tool definition and `case`

## Implementation notes
Block shape (deterministic: grouped by type in `ENTRY_TYPES` order, sorted by id, with no date in it, so a re-export with no entry changes gives no git diff):
```md
<!-- vibedoc:entries:start -->
## Project memory
_Generated from memory/entries/ by VibeDoc. Edit the entries, not this block._

### Conventions
- Only core.ts touches the file system: API routes import from core, never `fs`. (E001)

### Gotchas
...
<!-- vibedoc:entries:end -->
```
- Each line is the summary, then `: ` plus the body's first non-empty line cut to 200 chars when there is a body, then `(E00N)`. Skip empty type groups. With zero entries, write the block with `_No entries yet._`.
- `upsertManagedBlock`: replace the text between the markers when both exist; otherwise append the block after one blank line at the end. If only one marker exists, return an error, and don't write.
- Preserve the file's line endings (CRLF-safe, see the R045 fix in `updateMemory`).
- Reply: `📤 Exported 7 entries → AGENTS.md (updated), CLAUDE.md (unchanged)`.

## Acceptance criteria
- [x] On a project without `AGENTS.md`, the tool creates it with only the block. `CLAUDE.md` is not created
- [x] Text outside the markers is unchanged after export, including CRLF files
- [x] A second export with no entry changes reports `unchanged` and doesn't touch the files' mtime
- [x] A half-broken block (one marker) → a clear error, and the file is untouched
- [x] The check covers rendering, grouping and order, the first-line cut, insert vs replace, CRLF, and the one-marker error

## Verify
```bash
node src/lib/entries-export.check.mts
pnpm lint && pnpm build
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_export_memory","arguments":{}}}'
git diff AGENTS.md CLAUDE.md   # only the managed block changed
```
