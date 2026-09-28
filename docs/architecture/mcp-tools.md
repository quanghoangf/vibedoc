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

---

## Planning from chat

The chat sidebar can plan a roadmap or break an epic into tasks. The agent never writes files while it plans: it asks questions, proposes a plan, and the user accepts it in the UI.

Start it from the UI: **Plan with agent** on an empty `/roadmap`, or **Break down with agent** in an epic's detail sheet (shown when the epic has no tasks). Both open the chat and send the request. You can also just ask in the chat.

```
1. vibedoc_get_planning_guide { kind }   ← "roadmap" or "breakdown"; returns the steps to follow
2. read the project                      ← vibedoc_get_roadmap, vibedoc_list_tasks, vibedoc_read_doc, vibedoc_search_docs, vibedoc_get_file_map
3. vibedoc_ask_questions { questions }   ← shown as a card; the agent ends its turn
4. user answers in the card              ← answers arrive as the next user message
5. vibedoc_propose_plan { plan }         ← validated; on errors the agent fixes the plan and calls again
6. user reviews the plan card            ← can uncheck items, then Accept or Reject
7. Accept → POST /api/plan/apply         ← the only step that writes files
```

Steps 3–4 can repeat. After Accept, the new tasks appear on the board and the new items on `/roadmap` (SSE `task_created` / `roadmap_updated`).

---

### `vibedoc_get_planning_guide`
Load the instructions for planning from chat. Call it first when the user asks to plan a roadmap or break down an epic, then follow what it returns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `kind` | `"roadmap"` \| `"breakdown"` | ✅ | `roadmap` = plan horizons and epics; `breakdown` = split one epic into tasks |

**Returns:** a short preamble that maps the terminal skill to the chat tools (use `vibedoc_ask_questions` instead of AskUserQuestion, `vibedoc_propose_plan` instead of writing, no shell or file access), followed by the bundled skill body (`skills/roadmap-planner/SKILL.md` or `skills/epic-breakdown/SKILL.md`).

**Writes:** nothing.

---

### `vibedoc_ask_questions`
Ask the user 1–4 multiple-choice questions. The chat UI shows them as a card. The tool cannot wait for answers: after the call, the agent ends its turn.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `questions` | array (1–4) | ✅ | Questions to show |
| `questions[].question` | string | ✅ | The full question |
| `questions[].header` | string | ✅ | Short label (max ~12 chars), used as the answer key |
| `questions[].multiSelect` | boolean | ✅ | `true` = checkboxes, `false` = one choice |
| `questions[].options` | `{label, description?}[]` (2–4) | ✅ | Choices. The card always adds an "Other" free-text option |

**Returns:** a confirmation that tells the agent to end its turn. Invalid input returns an error that lists every problem.

**Answers** arrive as the next user message, one line per question keyed by its header:
```
Answers:
- Scope: Label A, Label B
- Budget: Other: "free text"
```

**Writes:** nothing.

---

### `vibedoc_propose_plan`
Propose a plan for the user to review. The server validates it against the current roadmap and tasks; on errors, the agent fixes the plan and calls again. The chat UI shows the plan as a card with a checkbox per item.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `plan.kind` | `"breakdown"` \| `"roadmap"` | ✅ | Which kind of plan |
| `plan.epic` | string | breakdown | Epic id, e.g. `R004` (not a horizon) |
| `plan.tasks` | `{key, title, size?, dependsOn?, due?, body}[]` | breakdown | New tasks |
| `plan.horizons` | `{key, title, body?}[]` | roadmap | New horizons (no parent) |
| `plan.epics` | `{key, title, parent, body}[]` | roadmap | New epics |

- `key` is stable within the plan (`t1`, `h1`, `e1`). It becomes a real id (`T042`, `R044`) on apply.
- Task `size`: `S (~1 hr)` \| `M (2–3 hrs)` \| `L (half day)`. `due`: `YYYY-MM-DD`. `body`: the full markdown below the meta block (`## Goal`, `## Context`, `## Scope`, `## Files`, `## Acceptance criteria`, `## Verify`).
- Task `dependsOn`: keys of earlier tasks in this plan, or existing task ids (`"T030"`).
- Epic `parent`: an existing horizon id (`R002`) or a horizon key in this plan (`h1`). Epic `body`: one outcome sentence, a blank line, then `**In scope:**` / `**Out of scope:**` / `**Done when:**`.

**Returns:** a one-line summary ("Proposed 5 tasks for R040…"). Invalid plans return an error that lists every problem.

**Writes:** nothing. Files are written only when the user clicks Accept, which calls `POST /api/plan/apply`.

---

### `POST /api/plan/apply`
Not an MCP tool: the plan card calls this REST route on Accept. Honors `?root=`.

**Body:** `{ plan, selected }`, where `plan` is the proposed plan and `selected` is the list of checked keys.

**Behavior:**
- Re-validates the plan against the current files. A checked item that depends on an unchecked one is an error (a task on an unchecked task, an epic under an unchecked horizon).
- `breakdown`: creates `plans/tasks/T*.md` for the checked tasks (phase = the epic, keys in `dependsOn` mapped to the new ids) and appends the new ids to the epic's `**Tasks:**` line.
- `roadmap`: creates the checked horizons, then the checked epics under them, as `plans/roadmap/R*.md`.
- Emits `task_created` per new task (breakdown) and `roadmap_updated`.

**Returns:** `200 { created: [{ key, id, file }] }`, or `400 { error }` on validation errors.
