# MCP Tools Reference
**Last updated:** 2026-09-28

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
1. vibedoc_read_memory             ← what happened last session?
2. vibedoc_next_task { epic }      ← claim the next ready task (returns its full spec, now in-progress)
3. vibedoc_search_docs             ← find relevant docs before writing
4. ... do the work, vibedoc_write_doc as needed ...
5. vibedoc_update_task <id> done   ← mark done when finished
6. repeat from 2 until next_task says "finished" or "nothing ready"
7. vibedoc_update_memory           ← write handoff for next session
```

For a task outside an epic, pick it by hand: `vibedoc_get_status` → `vibedoc_get_task <id>` → `vibedoc_update_task <id> in-progress` → work → `vibedoc_update_task <id> done`.

The `/work-epic <epic id>` skill ([`skills/work-epic/SKILL.md`](../../skills/work-epic/SKILL.md)) runs this loop for Claude Code.

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

### `vibedoc_next_task`
Claim the next ready task of an epic and move it to `in-progress`. Call it again after you mark that task `done`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epic` | string | ✅ | Epic roadmap id, e.g. `"R037"` (case-insensitive). A horizon id (no `**Parent:**`) or an unknown id returns an error. |

**Which task is ready:** walk the epic's `**Tasks:**` list in order and take the first task that is `todo` and whose `**Depends on:**` tasks (every `T\d+` in that line) are all `done` or `cancelled`. `blocked` and `in-progress` tasks are skipped.

**Claim semantics:** picking and moving to `in-progress` happen under one in-process lock, so two agents calling at the same time never get the same task. The lock covers one VibeDoc process only; a second VibeDoc process on the same project root is not covered. A stale `in-progress` task (an agent that claimed it and died) is **not** reclaimed automatically: reset it to `todo` with `vibedoc_update_task`.

**Returns:** one of three kinds.

**1. Claimed** — the task is now `in-progress`; the response carries its full file, plus a roadmap hint when the epic status is out of sync:
```
🔨 Claimed **T001** Form (now in-progress)

## plans/tasks/T001-form.md

# T001: Form
**Status:** 🔨 In-progress
...
```

**2. Nothing ready** — one reason per unfinished task. When no remaining task can move without someone unblocking it (or creating a missing task file), a "Needs a human" line follows; without it, other agents are still working, so wait and call again:
```
⏳ Nothing ready in R010.
- T001 is blocked
- T002 waits on T001 (blocked)

Needs a human: unblock one of the tasks above.
```

**3. Finished** — every linked task is `done` or `cancelled`. Stop the loop. If the epic status is not yet `done`, a nudge to update it follows:
```
✅ Epic R010 is finished — all 2 tasks done or cancelled. Stop here.

🗺️ R010 "Login": all tasks done but status is planned → vibedoc_update_roadmap_item { "id": "R010", "status": "done" }
```

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
