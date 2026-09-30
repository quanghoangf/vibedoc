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
   vibedoc_get_sessions            ← (optional) what other agents did since
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

**Returns:** markdown summary of board state + active/blocked tasks, ending with a pointer to `vibedoc_get_sessions`

---

### `vibedoc_get_sessions`
Sessions grouped from the activity log, newest first. A session is one actor's events without a 30-minute break; `session_start` always opens a new one. Use it at session start to catch up on what other agents did.

**Parameters:**
- `limit` (number, optional) — max sessions, default 10
- `taskId` (string, optional) — only sessions that moved this task
- `since` (string, optional) — ISO timestamp; only sessions that ended at or after it

**Returns:** one block per session, or `No sessions touched T001.` / `No sessions since <since>.` when nothing matches:
```
### 🤖 Agent · 2026-09-28T09:22:50.058Z (4m)
2 tasks moved (1 done) · 1 roadmap edit
- T046 → done
- T047 → in-progress
- 📄 docs/api.md
- 📝 ADR-004: Use SSE
```

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
| `status` | enum | ✅ | `todo` \| `in-progress` \| `review` \| `done` \| `blocked` \| `cancelled` |
| `manualTests` | string | | Manual test report, a markdown checklist saved as the task's `## Manual tests` section (replaces an older one). See [Manual tests & review](#manual-tests--review) |

Every transition is allowed: nothing requires a report or a review before `done`.

**Returns:** confirmation with previous and new status, and `🧪 Manual tests: 0/N ticked` when the task has a report

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

### `vibedoc_get_roadmap`
Get the product roadmap: horizons with their epics, statuses, linked tasks, progress and due dates. No parameters.

**Progress** `[N/M done]` is derived from task status, never stored:
- **Epic:** done tasks / linked tasks (cancelled tasks don't count).
- **Horizon:** the sum of its epics' task progress. An epic without tasks counts as one unit, done when the epic is `done`.

**At risk** — an epic that is not `done` gets ` ⚠ at risk` on its line, plus an entry under "⚠️ Needs attention" with the reasons, when any of these hold:
- a linked task is not done and its `**Due:**` is before today → `T040 overdue since 2026-09-20`
- a linked task is `blocked` → `T041 blocked`
- the epic is due within 7 days and no linked task is `done` or `in-progress` (or it has no tasks) → `due 2026-10-02, nothing started`

```
### ◐ **R002** Near-term — in-progress [6/17 done]
- ◐ **R038** Epic & horizon progress — in-progress (tasks: T035, T036) [1/2 done] ⚠ at risk

### ⚠️ Needs attention
- R038 "Epic & horizon progress" at risk: T036 blocked
```

The same rules drive the ⚠ mark and the "need attention" panel on the `/roadmap` page (`src/lib/roadmap-health.ts`).

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

## Manual tests & review

After a task, the agent leaves a **manual test report**: what a person should click through, and what they should see, before trusting "done". It is encouraged, never required, and nothing blocks moving a task to done.

**The report** is passed as `manualTests` on `vibedoc_update_task` and saved at the end of the task file. `/work-epic` writes one for every task it finishes. Plain lines become unticked steps.

```md
## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open /roadmap, click an epic → its sheet shows a Chat button
### Regression risk
- [ ] Dragging a card between columns still works
```

- The board card shows `🧪 done/total`: muted while items remain, green when all are ticked. Click it to open the checklist.
- **`/manual-tests`** lists every task with unticked items, grouped by epic, newest report first. Ticking an item writes `- [x]` to the task file (`POST /api/tasks/manual-tests` `{ id, index, checked }`) and never changes the task's status. **Show fully tested** lists the rest. The sidebar link counts unticked items.
- A new report replaces the old one, because the code changed and old ticks no longer apply.

**Review is an optional status** (`👀 Review`), a column between In progress and Todo:

```
in-progress ──► review ──► Approve    ──► done
                   └─────► Send back  ──► todo   (note required)
```

- Approve and Send back are in the task panel (`POST /api/tasks/review` `{ id, action: "approve" | "send-back", note? }`: 400 for an empty send-back note, 409 when the task isn't in review). Both are recorded in the task's `## Review` section, which the panel shows as history.
- A sent-back todo card shows **changes requested**. When `vibedoc_next_task` hands it out again, the reply starts with `⚠️ Changes requested:` and the note.
- A task in review is not done: its dependents wait, the epic isn't finished, and `vibedoc_next_task` says `T0xx in review — needs a human`.
- `/work-epic` defaults to done. It uses review only when it can't judge the result itself (a visual change it couldn't see, or a Verify step it couldn't run).

Why a checklist and not a done gate: [ADR-005](decisions/ADR-005-manual-test-checklist-instead-of-a-done-gate.md).

---

## Planning from chat

The agent chat can plan a roadmap, break an epic into tasks, or turn a feature spec into tasks. The agent never writes files while it plans: it asks questions, proposes a plan, and the user accepts it in the UI.

Start it from the UI. Each entry point opens the chat and sends the request. You can also just ask in the chat.

| Entry point | Where | Sends |
|---|---|---|
| **Plan with agent** | empty `/roadmap` | "Plan a roadmap for this project." |
| **Break down with agent** | an epic's detail sheet (epic has no tasks) | "Break down epic R0NN into tasks." |
| **Break down epics…** | `/roadmap` toolbar | the same message, one new chat per checked epic |
| **Plan from spec** | `/roadmap` toolbar (and the empty state) | a dialog to paste a spec → "Break down this spec into tasks: …" |
| **Break down with agent** (list icon) | a `.md` doc's header | "Break down the spec in `<path>` into tasks." |

For a spec, the agent first asks where the tasks go: a **new epic** under a horizon, an **existing epic**, or **no epic** (loose tasks). A spec that lives in a doc is read with `vibedoc_read_doc`, and the new epic and tasks get a ``Spec: `<path>` `` line that links back to it.

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

### Agent chats

Every chat is its own Claude session and its own `claude -p` turn, so several agents can run at once. `ChatProvider` (`src/context/ChatContext.tsx`) owns them all; one `ChatView` renders in two frames that are the same chat:

- **Modal** (`ChatModal`): the header **Agent** button, the `c` key, and the Chat buttons on roadmap epics, their task rows and board tasks. **Open as page** moves it to `/chat?id=…`.
- **`/chat` page**: all chats grouped as Needs you / Running / Recent, the conversation, and a context rail for the attached epic or task (status, progress, tasks, brief or spec).
- **Sidebar "Agents" section**: the same grouping, most urgent first. A running chat shows a spinner; waiting for your answers is amber; a plan or edit to review is accent; error is red.

Details:

- **Attach to an epic or task.** A chat opened from an item is attached to it (`attach: { kind, id }`); opening it again resumes the newest chat on that item (`showAbout`). Its first turn tells the agent to read the item (`vibedoc_get_roadmap` / `vibedoc_get_task`). "Break down epic R0NN…" attaches the chat to that epic. The item shows the chat's status on the map node, timeline, epic sheet, task rows and board cards.
- **New chat if busy.** `askAgent(message, { newChat })` (`src/lib/ask-agent.ts`) sends to the current chat when it is idle, otherwise to a new chat, and shows it. `newChat: true` runs in the background (the multi-epic dialog).
- **Cap: 4 running chats** (`MAX_RUNNING_CHATS` in `src/lib/chats.ts`), one `claude -p` process each. An ask over the cap is refused with a notice.
- **Break down epics…** (`/roadmap` toolbar): tick up to the free slots; each checked epic starts its own chat with "Break down epic R0NN into tasks.".
- **Stop / delete.** Stop aborts the request and `/api/chat` kills the `claude -p` child. Deleting a chat (× on `/chat`) also stops it; with unreviewed plan or edit cards you confirm first.
- **Saved.** Each chat is saved to `.vibedoc/chats/<id>.json` (`/api/conversations`) when a turn starts and ends and when you resolve a card, so chats survive a reload and follow-ups resume the same Claude session. A turn cut off by a reload shows as interrupted. Empty chats are not saved. Add `/.vibedoc/chats/` to the project's `.gitignore` if you don't want conversations in git.
- **No id collisions.** Plans get real T ids only at Accept. `applyPlan()` runs under `withTaskClaimLock`, so you can accept plans from several chats in any order. Check: `node e2e/parallel-chats.mjs`.

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
| `plan.epic` | string | breakdown, optional | Existing epic id, e.g. `R004` (not a horizon) |
| `plan.newEpic` | `{title, parent, body}` | breakdown, optional | Create this epic with the tasks. `parent` is an existing horizon id. Not together with `epic` |
| `plan.tasks` | `{key, title, size?, dependsOn?, due?, body}[]` | breakdown | New tasks |
| `plan.horizons` | `{key, title, body?}[]` | roadmap | New horizons (no parent) |
| `plan.epics` | `{key, title, parent, body}[]` | roadmap | New epics |

- `key` is stable within the plan (`t1`, `h1`, `e1`). It becomes a real id (`T042`, `R044`) on apply.
- Task `size`: `S (~1 hr)` \| `M (2–3 hrs)` \| `L (half day)`. `due`: `YYYY-MM-DD`. `body`: the full markdown below the meta block (`## Goal`, `## Context`, `## Scope`, `## Files`, `## Acceptance criteria`, `## Verify`).
- Task `dependsOn`: keys of earlier tasks in this plan, or existing task ids (`"T030"`).
- Breakdown target: `epic` (an existing epic), `newEpic` (create one), or neither (loose tasks, written with no phase). Validation errors: both set; `newEpic` parent missing, not found, or an epic (max depth 2); `newEpic` title missing or already used under that horizon; `newEpic` body not a string.
- Epic `parent`: an existing horizon id (`R002`) or a horizon key in this plan (`h1`). Epic `body`: one outcome sentence, a blank line, then `**In scope:**` / `**Out of scope:**` / `**Done when:**`.

**Returns:** a one-line summary ("Proposed 5 tasks for R040…", "…for new epic "Export"…", "…for no epic…"). Invalid plans return an error that lists every problem.

**Writes:** nothing. Files are written only when the user clicks Accept, which calls `POST /api/plan/apply`.

---

### `POST /api/plan/apply`
Not an MCP tool: the plan card calls this REST route on Accept. Honors `?root=`.

**Body:** `{ plan, selected }`, where `plan` is the proposed plan and `selected` is the list of checked keys.

**Behavior:**
- Re-validates the plan against the current files. A checked item that depends on an unchecked one is an error (a task on an unchecked task, an epic under an unchecked horizon).
- `breakdown`: with `newEpic`, first creates the epic (`planned`, under its horizon). Then creates `plans/tasks/T*.md` for the checked tasks (phase = the epic, keys in `dependsOn` mapped to the new ids) and appends the new ids to the epic's `**Tasks:**` line. With no epic, the tasks are written with no phase and no roadmap file changes. Not atomic: if a task write fails after the new epic is created, the epic stays with no tasks.
- `roadmap`: creates the checked horizons, then the checked epics under them, as `plans/roadmap/R*.md`.
- Emits `task_created` per new task (breakdown), and `roadmap_updated` when a roadmap item was created or linked.

**Returns:** `200 { created: [{ key, id, file }] }`, or `400 { error }` on validation errors.
