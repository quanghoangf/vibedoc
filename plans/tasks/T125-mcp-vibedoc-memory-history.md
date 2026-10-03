# T125: MCP vibedoc_memory_history (list · restore)
**Status:** ✅ Done
**Done:** 2026-10-03
**Phase:** R045 — Safe memory updates
**Size:** S (~1 hr)
**Depends on:** T124

## Goal
An agent that wrote a bad handoff, or that finds the handoff was clobbered, can list the earlier versions of MEMORY.md and restore one without a person stepping in.

## Context
- Epic: `plans/roadmap/R045-safe-memory-updates.md`
- `listMemoryVersions` / `getMemoryVersion` / `restoreMemoryVersion` come from T124.
- `/api/mcp` is hand-rolled JSON-RPC. Call `emitUpdate()` after mutations in the route, never in core.
- The chat sidebar's agent (`/api/chat`) disallows destructive tools (see `--disallowedTools` in `src/app/api/chat/route.ts`). Restore is undoable because it snapshots first, so it may stay allowed.

## Scope
- [x] Tool `vibedoc_memory_history`, args `{ id?: string, restore?: boolean }`:
  - [x] No `id` → compact lines, newest first: `<id> · <at> · <actor> · <reason> · <excerpt>` (max 20).
  - [x] `id` alone → that version's content.
  - [x] `id` + `restore: true` → restore it, `emitUpdate("memory_updated")`, and reply `Restored MEMORY.md to <at>; the replaced version is <newId>`.
- [x] Unknown id → a readable error string, not a JSON-RPC error.
- [x] Add it to the tools list (after `vibedoc_update_memory`) and update the tool count wherever one is stated.

**Out of scope:** the UI (T126).

## Files
- `src/app/api/mcp/route.ts`: tool definition and case

## Acceptance criteria
- [x] `tools/list` includes `vibedoc_memory_history`.
- [x] List → `{id}` → `{id, restore:true}` works end to end against a fixture. After the restore, `vibedoc_read_memory` shows the restored handoff.
- [x] An invalid id returns the message `Version <id> not found` and changes nothing.

## Verify
```bash
pnpm lint && pnpm build
curl -s localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_memory_history","arguments":{}}}'
```
