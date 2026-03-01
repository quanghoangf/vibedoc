# High-Level Design
**Last updated:** 2025-02-28

## Request flows

### AI agent moves a task (the core loop)
```mermaid
sequenceDiagram
    participant AI as Claude Code/Cursor
    participant MCP as /api/mcp/route.ts
    participant Core as core.ts
    participant SSE as SSE Bus
    participant Browser as Browser (SSE listener)

    AI->>MCP: POST /api/mcp<br/>{method: "tools/call", vibedoc_update_task, T003→done}
    MCP->>MCP: handleTool("vibedoc_update_task")

    MCP->>Core: updateTaskStatus("T003", "done", root)
    Note over Core: reads plans/tasks/T003-*.md<br/>replaces **Status:** line<br/>writes file to disk<br/>appends to .vibedoc-activity.json

    MCP->>SSE: emitUpdate("task_updated", {taskId, status, task})
    Note over SSE: broadcasts to all connected browsers

    MCP-->>AI: JSON-RPC response

    SSE->>Browser: {type: "task_updated", payload: {...}}
    Browser->>Browser: calls refresh()
    Browser->>MCP: GET /api/tasks
    Note over Browser: re-renders kanban board<br/>card moves column < 500ms
```

### Human opens a doc
```mermaid
sequenceDiagram
    participant Browser
    participant API as /api/docs/route.ts
    participant Core as core.ts
    participant UI as page.tsx

    Browser->>API: GET /api/docs?read=user-service/API
    API->>Core: readDoc("user-service/API", root)
    Note over Core: glob search → reads file<br/>returns {path, content}
    Core-->>API: {path, content}
    API-->>Browser: {path, content}
    Browser->>UI: setSelectedDoc({path, content})
    Note over UI: renders markdown in doc viewer panel
```

### AI starts a session
```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant MCP as /api/mcp
    participant SSE as SSE Bus
    participant Browser

    Note over AI: Claude Code detects MCP server

    AI->>MCP: tools/call: vibedoc_read_memory
    MCP->>MCP: readMemory(root) + logSessionStart(root)
    MCP->>SSE: emitUpdate("session_start")
    SSE->>Browser: session_start event
    Note over Browser: Activity tab shows<br/>"🤖 Session started"
    MCP-->>AI: MEMORY.md content

    Note over AI: Ideal workflow:
    AI->>MCP: 1. vibedoc_read_memory
    Note over AI: what happened last session?
    AI->>MCP: 2. vibedoc_get_status
    Note over AI: what's active/blocked now?
    AI->>MCP: 3. vibedoc_get_task T003
    Note over AI: read full spec before starting
    AI->>MCP: 4. vibedoc_update_task T003 in-progress
    Note over AI: ... does work ...
    AI->>MCP: 5. vibedoc_update_task T003 done
    AI->>MCP: 6. vibedoc_update_memory
    Note over AI: write handoff for next session
```

## Component responsibilities

### `src/lib/core.ts`
The only file that touches the file system. Every read/write goes through here.
- `findRoot()` / `getConfiguredRoot()` — project root detection
- `listDocs()` / `readDoc()` / `searchDocs()` — doc operations
- `listTasks()` / `getTask()` / `updateTaskStatus()` — task operations
- `readMemory()` / `updateMemory()` — session memory
- `logDecision()` — ADR creation
- `readActivity()` / `appendActivity()` — activity log
- `getProjectSummary()` — combined status (used by dashboard)

### `src/lib/events.ts`
Singleton SSE event bus. Lives in the Node.js process.
```
emitUpdate(type, payload) → all connected SSE clients receive it
```
All API routes call `emitUpdate()` after mutations. Never call from `core.ts`.

### `src/app/api/mcp/route.ts`
Hand-rolled JSON-RPC 2.0 MCP handler. **No MCP SDK stdio transport** (incompatible with Next.js).
Registers 10 tools. Each tool calls `core.ts` functions directly.

### `src/app/page.tsx`
Single client component. Manages all UI state with `useState`. Fetches from API routes.
SSE subscription in `useEffect` — refreshes relevant data on each event type.
