# MCP Server — Tool Catalog
**Endpoint:** `POST http://localhost:3000/api/mcp`
**Protocol:** JSON-RPC 2.0
**Last updated:** 2025-02-28

## Connection config

### Claude Code
```json
{ "mcpServers": { "vibedoc": { "url": "http://localhost:3000/api/mcp" } } }
```
### Cursor / Windsurf
```json
{ "mcpServers": { "vibedoc": { "url": "http://localhost:3000/api/mcp" } } }
```

---

## Tools

### `vibedoc_read_memory`
**Call at:** start of every session
Reads `memory/MEMORY.md`. Also logs a `session_start` event to the activity feed.
```json
{ "name": "vibedoc_read_memory", "arguments": {} }
```

### `vibedoc_get_status`
**Call at:** start of session, when disoriented
Returns board counts, active tasks, blocked tasks, doc count, memory last-updated.
```json
{ "name": "vibedoc_get_status", "arguments": {} }
```

### `vibedoc_list_tasks`
List all tasks with status. Filter by column optionally.
```json
{ "name": "vibedoc_list_tasks", "arguments": { "status": "in-progress" } }
// status: "all" | "todo" | "in-progress" | "blocked" | "done" | "cancelled"
```

### `vibedoc_get_task`
Read full task file — scope, acceptance criteria, DoD.
```json
{ "name": "vibedoc_get_task", "arguments": { "taskId": "T003" } }
```

### `vibedoc_update_task` ⚡ triggers real-time UI update
Move a task to a new status. Browser updates live.
```json
{ "name": "vibedoc_update_task", "arguments": { "taskId": "T003", "status": "done" } }
// status: "todo" | "in-progress" | "done" | "blocked" | "cancelled"
```

### `vibedoc_read_doc`
Read any doc by logical name or path fragment.
```json
{ "name": "vibedoc_read_doc", "arguments": { "query": "HLD" } }
{ "name": "vibedoc_read_doc", "arguments": { "query": "user-service/API" } }
{ "name": "vibedoc_read_doc", "arguments": { "query": "ADR-003" } }
// Accepts: filename, path fragment, short name (case-insensitive glob fallback)
```

### `vibedoc_list_docs`
List all docs grouped by section. Use to discover what exists.
```json
{ "name": "vibedoc_list_docs", "arguments": {} }
```

### `vibedoc_search_docs`
Full-text search across all `.md` files.
```json
{ "name": "vibedoc_search_docs", "arguments": { "query": "circuit breaker" } }
```

### `vibedoc_log_decision` ⚡ triggers real-time UI update
Write a new ADR. Auto-numbered, updates `_INDEX.md`.
```json
{
  "name": "vibedoc_log_decision",
  "arguments": {
    "title": "Use SSE instead of WebSockets for real-time",
    "context": "Need real-time browser updates when AI mutates tasks",
    "decision": "Use Server-Sent Events via a ReadableStream in Next.js API route",
    "rationale": "SSE is unidirectional (server → client) which is all we need. No WebSocket server overhead. Works natively in Next.js without extra packages.",
    "alternatives": [
      { "option": "WebSockets", "reason": "Overkill for unidirectional updates; needs separate WS server" },
      { "option": "Polling", "reason": "Wastes requests; adds latency" }
    ],
    "consequences": "Browser must reconnect on disconnect. Heartbeat every 25s prevents proxy timeouts."
  }
}
```

### `vibedoc_update_memory` ⚡ triggers real-time UI update
Write session summary to `memory/MEMORY.md`. **Call at end of every session.**
```json
{
  "name": "vibedoc_update_memory",
  "arguments": {
    "currentState": "Board and docs tabs are working. Activity feed shows real-time events. Memory tab renders MEMORY.md.",
    "justCompleted": ["Implemented SSE event bus", "Built MCP endpoint", "Built kanban board UI"],
    "workingOn": "Nothing currently",
    "upNext": ["Doc editor (inline editing)", "Drag-and-drop kanban", "ADR viewer tab"],
    "handoff": "App is running and the 4 main tabs work. Next priority is T004 (doc editor) — add a textarea edit mode to the doc viewer. File is src/app/page.tsx, look for the selectedDoc panel."
  }
}
```

---

## Adding a new tool
1. Add to `TOOLS` array in `/api/mcp/route.ts` (name, description, inputSchema)
2. Add `case 'vibedoc_your_tool':` in `handleTool()` 
3. Add core logic to `src/lib/core.ts` if it touches the file system
4. Call `emitUpdate()` if it mutates anything
5. Document here
