# MCP Tools Reference
**Last updated:** 2026-10-04

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
1. vibedoc_read_memory             ← what happened last session? (ends with the knowledge entry index)
   vibedoc_update_memory           ← only if it showed "⚠ Memory warnings": fix the handoff first
   vibedoc_get_sessions            ← (optional) what other agents did since
2. vibedoc_next_task { epic }      ← claim the next ready task (returns its full spec, now in-progress)
3. vibedoc_search_docs             ← find relevant docs before writing
4. ... do the work, vibedoc_write_doc as needed ...
5. vibedoc_update_task <id> done   ← mark done when finished
6. repeat from 2 until next_task says "finished" or "nothing ready"
7. vibedoc_save_entry             ← save facts that outlast the session (conventions, gotchas, …)
   vibedoc_update_memory           ← write handoff for next session
```

Forgot step 7? VibeDoc leaves an [automatic episode](#automatic-session-episodes) and the next `vibedoc_read_memory` shows it — but the handoff you write is better, so still call `vibedoc_update_memory`.

For a task outside an epic, pick it by hand: `vibedoc_get_status` → `vibedoc_get_task <id>` → `vibedoc_update_task <id> in-progress` → work → `vibedoc_update_task <id> done`.

The `/work-epic <epic id>` skill ([`skills/work-epic/SKILL.md`](../../skills/work-epic/SKILL.md)) runs this loop for Claude Code.

---

## Tool reference

### `vibedoc_get_status`
Get project status overview: active tasks, blockers, doc count, memory state. Call at every session start.

**Parameters:** none

**Returns:** markdown summary of board state + active/blocked tasks, ending with a pointer to `vibedoc_get_sessions`. One line names the frontend app (R057): `Frontend: apps/web (vite) · pnpm --filter web dev · http://localhost:5173`, or `Frontend: none detected`.

---

### `vibedoc_get_frontend`
The project's web frontend app, as Settings → Frontend app shows it (R057). Call before writing or running browser tests.

**Parameters:** none

**Returns:** the app's dir (and package name), framework, start command, URL, source (`detected`, or `override` when set in Settings / `frontend` in `.vibedoc/settings.json`), Playwright state (installed + version, or the install command to run in the app dir; Settings → Frontend app has an Install button), the login path when set, auth state (session saved + when, or no saved session), the other web apps in a monorepo, and warnings (VibeDoc's own repo, port clash):
```
## Frontend app
**Dir:** apps/web (web)
**Framework:** vite
**Start command:** pnpm --filter web dev
**URL:** http://localhost:5173
**Source:** detected
**Playwright:** installed v1.48.2
**Auth:** no saved session (Settings → Frontend app → Log in)
**Other apps:** apps/docs (astro)
```
No web app → a message that points to the Settings override.

**Routes** (UI, Settings → Frontend app; all take `?root=`; the POST/PUT/DELETE ones refuse cross-site requests and need `Content-Type: application/json`, and are off in the demo):
- `GET /api/frontend` → `{ app, notes, override, playwright, auth, login }` · `PUT /api/frontend { override: { dir?, startCommand?, url?, loginPath? } | null }` (null = reset to detected). Emits `frontend_updated`.
- `POST /api/frontend/playwright/install` → NDJSON stream of the install output (`{type:"output",text}` lines, then `{type:"done",ok,tail}`).
- `GET /api/frontend/server` → `{ state: "stopped"|"starting"|"running", url, startedByUs, error?, output? }` · `POST /api/frontend/server { action: "start"|"stop" }` (start reuses a server already answering; stop only kills one VibeDoc started, else 409). Emits `frontend_server_updated`.
- `POST /api/frontend/login` → opens a headed Chromium at the login URL, returns `{ started, url }`; closing it saves `.vibedoc/auth/storage-state.json` and emits `frontend_updated` · `DELETE /api/frontend/login` → `{ cleared, auth }`.
- `POST /api/frontend/smoke` → starts the app if it is down, opens its first page headless with the saved session, screenshots it, and stops the app again if it started it: `{ ok, finalUrl, status, durationMs, startedServer, screenshot, notes, error? }`. `ok` = the page loaded with an HTTP status below 400; `notes` has "Looks logged out" when the final URL is on the login path and "No saved session" when there is none. 409 when Playwright or Chromium is missing. Emits `frontend_updated`. `GET /api/frontend/smoke` → the last screenshot (`image/png`), 404 when there is none.

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

**Returns:** full content of `memory/MEMORY.md`, then — when a [session episode](#automatic-session-episodes) ended after MEMORY.md was last written — `## Since the last handoff (auto, YYYY-MM-DD)` with the newest one (`+N older episodes in .vibedoc/episodes/` when there are more), then `## Knowledge entries (N)` with one `E001 · type · summary (~N tok)` line per entry, newest first, capped at `memory.sessionBudgetTokens` (`.vibedoc/settings.json`, default 2000 tokens; the handoff and the episode are never cut, index lines drop first → `+N more entries`, use `vibedoc_recall`)

Directly under the handoff (never cut by the budget) comes the [memory warnings block](#memory-cleanup) when the handoff contradicts the board — fix the handoff with `vibedoc_update_memory` before starting work.

Before answering it backfills an `inferred` episode for up to 5 ended agent sessions since the last MEMORY.md write that have no handoff and no episode (never the session still running), so the reply can show them.

---

### `vibedoc_save_entry`
Save one long-lived fact as its own file, `memory/entries/E001-<slug>.md`. A fact that should still be true next week goes in an entry; what happened this session goes in the handoff.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `convention` \| `gotcha` \| `decision` \| `preference` |
| `summary` | string | ✅ | One line, at most 120 characters (the file's H1) |
| `body` | string | | Details and the why (markdown) |
| `id` | string | | Entry to update, e.g. `E001`. Omit to create |

An update keeps the entry's `**Source:**` line ([`vibedoc_import_memory`](#vibedoc_import_memory)).

**Returns:** `🧠 Saved **E001** · convention · <summary>` and the file path. Unknown type, bad summary or unknown id → error, nothing written.

---

### `vibedoc_delete_entry`
Delete an entry that is wrong or no longer true. The file is removed; git keeps its history.

**Parameters:** `id` (string, required), e.g. `E001`

---

### `vibedoc_import_memory` ⚡ triggers real-time UI update
Import the developer's Claude Code memory for this project into knowledge entries (R052). Reads `~/.claude/projects/<slug>/memory/*.md` (`$CLAUDE_CONFIG_DIR` replaces `~/.claude`; `<slug>` = the absolute project root with every non-alphanumeric character as `-`), read-only. The folder is fixed: callers can't pass a path. The `MEMORY.md` index and files without frontmatter `name` + `description` are skipped.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | ✅ | `claude-code` (the only source; Cursor / Cline importers are out of scope) |
| `apply` | boolean | | Write the previewed entries. Default `false`: preview only, nothing written |

Each file becomes one entry: `description` → summary (at most 120 characters), the text after the frontmatter → body, `type` → entry type:

| Claude Code `type` | Entry type |
|---|---|
| `feedback`, `user` | `preference` |
| `project` | `decision` |
| `reference`, anything else, missing | `convention` |

The entry gets `**Source:** claude-code:<name>`. Re-imports dedupe on that line only: same type, summary and body → unchanged; otherwise the entry is updated in place (same id). An entry whose Claude Code file is gone is listed as `only in VibeDoc`, never deleted. Entries without a source never match.

**Returns:** one line per candidate, then the counts:
```
📥 Claude Code memory → 2 found in ~/.claude/projects/-Users-x-work-app/memory
+ new        decision    Use pnpm, the npm lockfile conflicts   (pnpm_only)
+ new        preference  Keep answers short   (terse)
= unchanged  0
2 new · 0 update · 0 unchanged
Call again with apply: true to write.
```
With `apply: true` the rows read `created` / `updated` and end with `Wrote N entries (… created · … updated).` (or `Nothing to write.`). One `memory_updated` activity event per apply. No memory file and no earlier import → `No Claude Code memory found at <dir>`; any other `source` → error.

`vibedoc_get_entries` prints `Source: claude-code:<name>` under the `updated` line of an imported entry.

---

### `vibedoc_export_memory` ⚡ triggers real-time UI update
Write the knowledge entries into a managed block of `AGENTS.md` (created when missing) and `CLAUDE.md` (only when it exists), so Cursor, Codex and other agents that read those files see the same conventions (R052).

**Parameters:** none

The block:
```markdown
<!-- vibedoc:entries:start -->
## Project memory
_Generated from memory/entries/ by VibeDoc. Edit the entries, not this block._

### Conventions
- <summary>: <first body line, ≤200 chars> (E001)
<!-- vibedoc:entries:end -->
```
Groups in order Conventions · Gotchas · Decisions · Preferences (empty ones skipped; `_No entries yet._` when there are none), ids ascending inside a group. No date, so an unchanged set renders byte-identical and the file is not rewritten. The block replaces the text between the markers, or is appended after a blank line when there are none; everything outside is kept byte-for-byte, line endings included. A lone or reversed marker in either file → error, neither file written.

**Returns:** `📤 Exported N entries → AGENTS.md (updated), CLAUDE.md (unchanged)`. Each changed file logs a `doc_updated` event and refreshes an open editor.

---

### `vibedoc_update_memory`
Update `MEMORY.md` with a session summary. Call at the **end** of every session so the next agent has context.

**Partial update (R045).** Only the sections you pass are rewritten; every other section — including hand-written ones such as `## Key conventions` — and the text above the first `##` stay byte-identical. All fields are optional, but pass at least one: none → error `Nothing to update: pass at least one of …`, nothing written. A field set to `null` or left out counts as not passed.

| Parameter | Type | Section it replaces | Rendered as |
|-----------|------|---------------------|-------------|
| `currentState` | string | `## Current state` | the text |
| `justCompleted` | string[] | `## Just completed` | `- ` bullets (empty → `- (nothing this session)`) |
| `workingOn` | string | `## Working on now` | the text (empty → `(nothing active)`) |
| `upNext` | string[] | `## Up next` | `1.` numbered list (empty → `1. (define next steps)`) |
| `issues` | (string \| `{issue, severity?, status?}`)[] | `## Active issues` | table; severity default `medium`, status default `open` |
| `decisions` | string[] | `## Recent decisions` | `- ` bullets (empty → `- (none this session)`) |
| `techDebt` | string[] | `## Tech debt` | `- ` bullets (empty → `- (none noted)`) |
| `handoff` | string | `## Handoff for next session` | the text |

- Headings match case-insensitively. A missing section is inserted in the order above (after the nearest earlier one, else before the nearest later one, else at the end).
- `## ` lines inside a passed value become `### `, so a value can't open a section of its own (lines inside ``` fences are left alone).
- `**Last updated:**` is set to the current date and time (inserted under the H1 when missing). No MEMORY.md yet → the full template is written, with placeholders for the fields you didn't pass.
- Before writing, the current file is saved as a version — see [`vibedoc_memory_history`](#vibedoc_memory_history).

**Returns:** `🧠 MEMORY.md updated`

---

### `vibedoc_memory_history`
Earlier versions of `MEMORY.md`. Every write (`vibedoc_update_memory`, `POST /api/memory`, a restore) first copies the current file to `.vibedoc/memory-history/<stamp>-<actor>.md`; the **20** newest are kept, older ones are deleted.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | | Version id from the list, e.g. `20261003T154209123Z-ai`. Omit to list |
| `restore` | boolean | | With `id`: write that version back to `MEMORY.md` |

**Returns:**
- No `id` → one line per version, newest first (at most 20): `<id> · <ISO time> · ai|human · update|restore · <first line of that version's handoff>`, or `No saved versions of MEMORY.md yet.`
- `id` → that version's full content. Unknown or malformed id → `Version <id> not found`.
- `id` + `restore: true` → `Restored MEMORY.md to <ISO time>; the replaced version is <new id>`. The file being replaced is saved first (reason `restore`), so restoring `<new id>` undoes it. Emits `memory_updated`, so an open `/memory` page updates live.

The Memory tab shows the same list under **History (N)**: a line diff from the current file to the chosen version, **Restore this version**, and an Undo toast.

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

### `vibedoc_get_evidence`
Read a task's evidence doc (R060): every checklist item with what its Playwright run proved, from the kept runs in `~/.vibedoc/runs/<project>/<taskId>/`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | ✅ | e.g. `"T138"` |
| `runId` | string | | A kept run to detail instead of the newest, e.g. `"20261004T074314Z"` |

**Returns:** markdown: the run's result, step count, time, commit and spec; each 🤖 item as ✅ / ❌ (with the error) / ⚠️ missing, each manual item ☐ / ☑; screenshot and video links as absolute file paths; a History table of kept runs. Formatted fresh on every call (ticks included) by `src/lib/evidence.ts`, the same formatter the fixture uses for `EVIDENCE.md`. Unknown `runId` → error. The UI reads the same doc from `GET /api/tasks/<id>/evidence?run=` with API links.

---

### `vibedoc_update_task`
Update a task's status. Triggers a real-time kanban board update in the browser.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | ✅ | e.g. `"T003"` |
| `status` | enum | ✅ | `todo` \| `in-progress` \| `review` \| `done` \| `blocked` \| `cancelled` |
| `manualTests` | string | | Manual test report, a markdown checklist saved as the task's `## Manual tests` section (replaces an older one). See [Manual tests & review](#manual-tests--review) |

Every transition is allowed: nothing requires a report or a review before `done`.

**Returns:** confirmation with previous and new status, and `🧪 Manual tests: 0/N ticked` when the task has a report. With `autoResult: "passed"`, VibeDoc re-judges the task's newest recorded run (R063): steps with no `expect` on the page are unticked, counted in the header (`· N unverified`) and listed in a final `⚠️ N steps unverified: …` line, which tells the agent to fix those steps

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

**Episode at run end:** on *Nothing ready* and *Finished*, if the caller's session moved something and wrote no `vibedoc_update_memory` handoff, VibeDoc writes its [episode](#automatic-session-episodes) (`**Source:** epic R010`) and the reply ends with `Episode saved → .vibedoc/episodes/<sessionId>.md`. Still call `vibedoc_update_memory` — the episode is the safety net.

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

## Automatic session episodes

`vibedoc_update_memory` is still the way to hand off: an agent writes what matters and what to do next. An **episode** is the safety net for a session that ended without it — a short summary VibeDoc builds from the session's activity (R050). Episodes never touch `MEMORY.md`.

**Where:** `.vibedoc/episodes/<sessionId>.md`, one per agent session (`src/lib/episodes.ts` builds it, pure; `core.ts` writes it).

**When it is written** — only for a session that changed something (doc reads and session starts alone don't count) and has no MEMORY.md write; saving entries is not a handoff:
| Trigger | Source line |
|---|---|
| A chat turn from the UI ends (`/api/chat`, after `claude -p` exits) | `chat <conversationId>` (a session shared by several chats lists each) |
| `vibedoc_next_task` returns *Nothing ready* or *Finished* | `epic R0xx` |
| `vibedoc_read_memory` finds an ended agent session (up to 5, since the last MEMORY.md write) with no episode | `inferred` |

**Format** (body ≤ 1600 characters, ≈ 400 tokens; the last message is trimmed first, then the lists):
```
# Episode ses_1790587370058_tzmkg: 1 task moved
**Session:** ses_1790587370058_tzmkg
**Actor:** ai:claude-code
**Start:** 2026-10-03T13:01:12.000Z
**End:** 2026-10-03T13:04:40.000Z
**Source:** chat c_abc123

## What happened
- T001 → in-progress

## Where it stopped
> Moved T001 to in-progress; the form validation is next.

## Open
- T001 Form (in-progress)
```

**How the next session sees it:** `vibedoc_read_memory` shows the newest episode whose `**End:**` is later than MEMORY.md's last write, under `## Since the last handoff (auto, <date>)`, right after the handoff. Once an agent calls `vibedoc_update_memory`, older episodes stop showing. Each write emits the SSE event `episode_saved`.

---

## Memory cleanup

VibeDoc checks memory against the board on every `vibedoc_read_memory` and on the Memory tab (`/memory`, **Cleanup (N)** button → `?cleanup=1`). Flags are derived on each read, never stored (pure rules in `src/lib/memory-health.ts`, `getMemoryHealth()` in core):

| Flag | Severity | When |
|------|----------|------|
| `contradiction` | ⚠ warn | MEMORY.md names a task or epic under **Working on now** / **Up next** that is done or cancelled, or a task under **Just completed** that isn't done |
| `dangling-ref` | info | MEMORY.md or an entry mentions a `T…` / `R…` id that doesn't exist; or (once the project has entries) MEMORY.md, an entry, a task, roadmap item or doc mentions an `E…` id that doesn't exist, e.g. after a merge or delete. Ids in code fences and `inline code` are examples and don't count |
| `duplicate` | info | Two or more entries say the same thing (keyword overlap ≥ 50%, grouped); the row offers **Merge…** |
| `stale` | info | No agent fetched the entry with `vibedoc_get_entries` for more than 60 days (or never, counted from `**Updated:**`); the row offers **Delete** with Undo |

**Warning block.** When there are `warn` flags, `vibedoc_read_memory` puts this right under the handoff (max 5 lines, the rest → `…and N more on /memory`):

```
## ⚠ Memory warnings
- ⚠ Handoff says T055 is in progress, but it is done
```

With only info flags it shows one line instead: `ℹ 3 memory cleanup suggestions on /memory`. **Agents: when you see the warning block, fix the handoff with `vibedoc_update_memory` before starting work.**

**Recall log.** `vibedoc_get_entries` records today's date per fetched id in `memory/.recall-log.json` — that is what "recalled" means for the `stale` flag (`vibedoc_recall` lists and the session index don't count). Deleting or merging an entry drops its id from the log.

**Merge.** **Merge…** opens a dialog (keep the oldest id by default, edit the merged summary and body). Approving rewrites the kept entry, deletes the others and points `E…` references in other entries at the kept id. Undo writes every touched file back byte-for-byte.

**Sidecar files** (both small JSON with sorted keys, so they diff cleanly; committing them is the project's choice):

| File | Holds |
|------|-------|
| `memory/.cleanup.json` | `{ "dismissed": { "<flag id>": "YYYY-MM-DD" } }` — a dismissed flag stays hidden while its id stays the same; deleting or merging away an entry drops the dismissals that name it, so an entry that reuses the id starts clean |
| `memory/.recall-log.json` | `{ "E004": "YYYY-MM-DD" }` — last `vibedoc_get_entries` fetch per entry, written at most once per id per day |

**Routes** (UI): `GET /api/memory/health[?dismissed=1]` → `{ flags }` · `POST /api/memory/health/dismiss { id }` · `POST /api/memory/entries/merge { keepId, dropIds, type, summary, body }` → `{ entry, before }` · `POST /api/memory/entries/merge/undo { before }`. Each mutation emits `memory_updated`.

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
- **`/manual-tests`** (Test review) lists every task with a checklist or a recorded run. The default **Needs you** tab holds tasks with a failed last run, tasks in review, and open (not done or cancelled) tasks with checks left; Failed · Passed · No run · All hold the rest. Ticking an item writes `- [x]` to the task file (`POST /api/tasks/manual-tests` `{ id, index, checked }`) and never changes the task's status.
- A new report replaces the old one, because the code changed and old ticks no longer apply.

**Review is an optional status** (`👀 Review`), a column between In progress and Todo:

```
in-progress ──► review ──► Approve    ──► done
                   └─────► Send back  ──► todo   (note required)
done (failed run) ───────► Send back  ──► todo   (/manual-tests)
```

- Approve and Send back are in the task panel and on /manual-tests (`POST /api/tasks/review` `{ id, action: "approve" | "send-back", note? }`: 400 for an empty send-back note, 409 when approving a task that isn't in review or sending back one that is neither in review nor done; `REVIEWABLE` in `src/lib/review.ts`). Both are recorded in the task's `## Review` section, which the panel shows as history.
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
