# T129: vibedoc_import_memory: preview then apply Claude Code memory
**Status:** ✅ Done
**Phase:** R052 — Cross-agent memory
**Size:** M
**Depends on:** T128

## Goal
An agent calls `vibedoc_import_memory { source: "claude-code" }` and sees what would be created, updated or left unchanged. It then calls the tool again with `apply: true`, and the project gets one `memory/entries/E*.md` per Claude Code memory, each with `**Source:** claude-code:<name>`. Running the import again doesn't create duplicates.

## Context
- Epic: `plans/roadmap/R052-cross-agent-memory.md`
- Builds on T128: `readClaudeMemory(root)`, `saveEntry({ ..., source })`, `Entry.source`.
- Decided: dedupe is by `source`. A candidate whose `claude-code:<name>` matches an existing entry is an **update** when its type, summary or body differ, otherwise **unchanged**. Everything else is **new**. Live two-way sync is out of scope: re-import overwrites the entry with the Claude Code text, and the preview is where the user sees that.
- Project rules: `/api/mcp` is hand-rolled JSON-RPC. Call `emitUpdate()` in the route after a mutation, never from `core.ts`.

## Scope
- [x] `src/lib/claude-memory.ts`: pure `planImport(candidates, entries)` → `{ create, update, unchanged }`, plus a check case
- [x] `core.ts`: `importClaudeMemory(root, actor, apply)` reads, plans and, when `apply` is true, saves through `saveEntry()` (so ids come from the existing entry lock)
- [x] `/api/mcp`: register `vibedoc_import_memory` next to `vibedoc_save_entry` and handle it
- [x] Activity: one `memory_updated` event per apply, title `Imported N entries from Claude Code`

**Out of scope:** Cursor and Cline sources. A UI on /memory. Deleting entries whose Claude Code memory was removed (list them as `only in VibeDoc` in the preview, but don't delete them). Export (T130).

## Files
- `src/lib/claude-memory.ts`, `src/lib/claude-memory.check.mts`
- `src/lib/core.ts`: `importClaudeMemory()`
- `src/app/api/mcp/route.ts`: the tool definition and `case`

## Implementation notes
MCP input: `{ source: "claude-code" (enum, required), apply?: boolean (default false) }`. Description: "Import the developer's Claude Code memory for this project into knowledge entries. Without apply it only previews; call again with apply: true to write."

Preview reply (also used after apply, with past tense):
```
📥 Claude Code memory → 5 found in ~/.claude/projects/-Users-x-work-app/memory
+ new        convention  API routes import from core.ts, never fs   (only-core-touches-fs)
~ update     E004        preference  Keep replies short
= unchanged  2
Call again with apply: true to write.
```
Show the directory with `~` in place of the home path. A missing folder is not an error: reply `No Claude Code memory found at <dir>`. After an apply that wrote at least one file, the route calls `emitUpdate("memory_updated", { root })`.

## Acceptance criteria
- [x] Without `apply`, nothing is written, and the reply lists the new, update and unchanged counts and the rows
- [x] With `apply: true`, new entries appear with the right type and `**Source:**`, and updated entries keep their id
- [x] Running the same apply twice → the second run reports everything as unchanged and writes no file
- [x] Unknown `source` → a tool error that lists `claude-code`
- [x] `planImport` check: create / update / unchanged, and an existing entry without a source is never matched

## Verify
```bash
node src/lib/claude-memory.check.mts
pnpm lint && pnpm build
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_import_memory","arguments":{"source":"claude-code"}}}'
```
Run it against this repo first (it has real Claude Code memory). Don't commit the imported entries unless you mean to.
