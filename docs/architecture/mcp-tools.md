# MCP Tools Reference
**Last updated:** 2026-03-02

VibeDoc exposes an MCP server at `/api/mcp` (HTTP JSON-RPC 2.0). AI coding agents connect here to read project state, manage tasks, and write documentation.

## Connection config

### Claude Code (`~/.claude/settings.json`)
```json
{
  "mcpServers": {
    "vibedoc": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### Cursor / Windsurf
Add the same `url` entry to your MCP server config.

---

## Recommended session workflow

```
1. vibedoc_read_memory    ← what happened last session?
2. vibedoc_get_status     ← what's active/blocked right now?
3. vibedoc_get_task       ← read the full spec before starting
4. vibedoc_update_task    ← mark in-progress when you start
5. vibedoc_search_docs    ← find relevant docs before writing
6. vibedoc_write_doc      ← create or update documentation
7. vibedoc_update_task    ← mark done when finished
8. vibedoc_update_memory  ← write handoff for next session
```

---

## Tool reference

### `vibedoc_get_status`
Get project status overview: active tasks, blockers, doc count, memory state. Call at every session start.

**Parameters:** none

**Returns:** markdown summary of board state + active/blocked tasks

---

### `vibedoc_read_memory`
Read `MEMORY.md` — the session handoff file written by the previous agent session. Also logs a session start event visible in the Activity tab.

**Parameters:** none

**Returns:** full content of `memory/MEMORY.md`

---

### `vibedoc_update_memory`
Update `MEMORY.md` with a session summary. Call at the **end** of every session so the next agent has context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `currentState` | string | ✅ | One-paragraph summary of where things stand |
| `handoff` | string | ✅ | What the next session should do first |
| `justCompleted` | string[] | | List of things finished this session |
| `workingOn` | string | | What is currently in progress |
| `upNext` | string[] | | Ordered list of next tasks |
| `issues` | string[] | | Open issues or blockers |
| `decisions` | string[] | | Key decisions made |
| `techDebt` | string[] | | New tech debt introduced |

---

### `vibedoc_list_tasks`
List all tasks as a kanban board, optionally filtered by status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | enum | | `all` \| `todo` \| `in-progress` \| `blocked` \| `done` \| `cancelled` (default: `all`) |

**Returns:** grouped task list with IDs and titles

---

### `vibedoc_get_task`
Read a specific task file in full — scope, acceptance criteria, definition of done.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | ✅ | e.g. `"T001"`, `"T003"` |

**Returns:** full markdown content of the task file

---

### `vibedoc_update_task`
Update a task's status. Triggers a real-time kanban board update in the browser.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | ✅ | e.g. `"T003"` |
| `status` | enum | ✅ | `todo` \| `in-progress` \| `done` \| `blocked` \| `cancelled` |

**Returns:** confirmation with previous and new status

---

### `vibedoc_list_docs`
List all documentation files grouped by section. Use to discover what docs exist before reading or writing.

**Parameters:** none

**Returns:** file paths grouped by section (root, memory, plans, decisions, architecture, etc.)

---

### `vibedoc_read_doc`
Read a documentation file by name. Uses fuzzy matching — no need for the full path.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Doc name, e.g. `"CLAUDE"`, `"HLD"`, `"ADR-001"`, `"user-service/API"` |

**Returns:** full markdown content with resolved path as header

---

### `vibedoc_search_docs`
Full-text search across all `.md` files. Returns files and line snippets sorted by hit count.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search term |

**Returns:** up to 20 matching files with up to 4 line hits each

---

### `vibedoc_write_doc`
Write or create a documentation file. Use to add new docs or update existing ones. The browser DocList refreshes in real time after write — the user can review and edit via the UI.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | ✅ | Relative path from project root, e.g. `"docs/api/endpoints.md"` |
| `content` | string | ✅ | Full markdown content to write |

**Notes:**
- Creates parent directories automatically
- Overwrites existing files — read first with `vibedoc_read_doc` if you want to preserve content
- Path must stay within project root (no `../` traversal)

**Example:**
```
vibedoc_write_doc({
  path: "docs/services/payment-service.md",
  content: "# Payment Service\n\n## Overview\n..."
})
```

---

### `vibedoc_log_decision`
Write a new Architecture Decision Record (ADR) when making a significant technical decision.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | ✅ | Short decision title |
| `context` | string | ✅ | Why this decision was needed |
| `decision` | string | ✅ | What was decided |
| `rationale` | string | | Why this option was chosen |
| `alternatives` | `{option, reason}[]` | | Other options considered |
| `consequences` | string | | Trade-offs and follow-ups |

**Returns:** ADR number and file path (written to `docs/architecture/decisions/ADR-NNN-*.md`)
