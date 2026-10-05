# VibeDoc

**Local-first project intelligence for AI-assisted development.** · [Website](https://quanghoangf.github.io/vibedoc/)

[![npm](https://img.shields.io/npm/v/vibedoc)](https://www.npmjs.com/package/vibedoc)
[![node](https://img.shields.io/node/v/vibedoc)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/vibedoc)](./LICENSE)
[![CI](https://github.com/quanghoangf/vibedoc/actions/workflows/ci.yml/badge.svg)](https://github.com/quanghoangf/vibedoc/actions/workflows/ci.yml)
[![Website](https://img.shields.io/badge/website-quanghoangf.github.io%2Fvibedoc-7c6af7)](https://quanghoangf.github.io/vibedoc/)

A kanban board + docs viewer + MCP server — all in one process, zero config.  
Point your AI agent at it. Watch tasks move in real time.
![alt text](image.png)

```
http://localhost:<port>         ← your browser (kanban, docs, activity, memory, explorer)
http://localhost:<port>/api/mcp ← AI agent connects here via MCP
```

**Why VibeDoc?** Most AI coding sessions lose context between chats. VibeDoc gives your agent a persistent home: it reads tasks from markdown files, writes decisions as ADRs, and updates a memory file at session end — so the next agent picks up exactly where the last one left off. The browser UI lets you watch everything happen live.

---

## Quick start

```bash
cd your-project
npx vibedoc
```

VibeDoc picks a free port automatically and opens the setup page in your browser.  
The port is printed in the terminal — use it when configuring your AI agent.

### Options

```bash
# Pin to a specific port
npx vibedoc --port 3333

# Print the installed version (also -v)
npx vibedoc --version

# Point at a different project
VIBEDOC_ROOT=/path/to/project npx vibedoc
```

---

## What you get

- **Kanban board** — tasks live in `plans/tasks/*.md`, rendered as draggable cards
- **Docs viewer** — browse and edit every markdown file in `docs/`. Relative `.md` links and `[[wikilinks]]` in the preview are clickable (broken ones are muted), hovering one shows a preview card, and the Linked docs panel lists what a doc links to, what links to it, its broken links and stale path mentions (backticked paths to files that no longer exist)
- **Graph** — `/graph` maps every link between the project's `.md` files (docs, ADRs, tasks, epics, entries) with a force layout, kind filters, search and focus. Shape shows the kind, colour the task/epic status; live agent changes flash in place without moving the camera, and a menu lists broken links and stale paths. Fully keyboard-driven: `/` to search, Tab through files, Enter to select, Enter again to open, arrows to follow links, Esc to clear
- **Live activity feed** — every AI action appears instantly via SSE, no polling
- **Memory tab** — the `MEMORY.md` session handoff, plus a browser for knowledge entries: search (ranked like `vibedoc_recall`), filter by type, open, edit, add, and delete with Undo. Each entry shows who changed it last (a person or a named agent). **Cleanup** flags a handoff that contradicts the board, ids that don't exist, duplicate entries (merge with Undo) and entries no agent recalled in 60 days
- **File explorer** — treemap/tree/heatmap views of your docs with AI-generated descriptions
- **Roadmap** — a roadmap.sh-style map of `plans/roadmap/*.md`: horizons on a spine, features branching off with status badges; drag nodes, edit inline
- **Plan from the chat** — ask the agent sidebar to plan a roadmap or break an epic into tasks; it asks questions, shows the plan, and writes nothing until you accept
- **Manual tests & review** — the agent leaves a click-through checklist on each finished task (`🧪 0/5` on the card, ticked on `/manual-tests`); an optional Review column lets you approve a task or send it back with a note. Nothing ever blocks "done"
- **MCP server** — 45 tools your AI agent can call to read docs, move tasks, write ADRs, and more

---

## Connect your AI agent

### Claude Code (`~/.claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "vibedoc": {
      "url": "http://localhost:<port>/api/mcp"
    }
  }
}
```

### Cursor (`.cursor/mcp.json` in project root)

```json
{
  "mcpServers": {
    "vibedoc": {
      "url": "http://localhost:<port>/api/mcp"
    }
  }
}
```

### Windsurf (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "vibedoc": {
      "url": "http://localhost:<port>/api/mcp"
    }
  }
}
```

> The port is shown in the terminal when VibeDoc starts. Use `--port` to pin it.

### Agent skills (Claude Code plugin)

The planning loop ships as a Claude Code plugin named `vibedoc` (in [`plugin/`](plugin/)):

| Command | What it does |
|---|---|
| `/vibedoc:roadmap` | Interview you about goals and write horizons + epics (`plans/roadmap/R*.md`) |
| `/vibedoc:breakdown R004` | Break one epic into tasks an agent can pick up cold (`plans/tasks/T*.md`) |
| `/vibedoc:work R004` | Claim, build, verify, test and commit the epic's tasks one by one |
| `/vibedoc:next` | The single most useful next step, with the command to run |

```text
/plugin marketplace add quanghoangf/vibedoc
/plugin install vibedoc@vibedoc
```

Working on the skills themselves: start Claude Code with `claude --plugin-dir ./plugin` from this repo, so edits apply after `/reload-plugins` (an installed plugin is a copy). VibeDoc's agent chat reads the same files (`plugin/skills/roadmap` and `plugin/skills/breakdown`).

---

## MCP tools

45 tools your AI agent can call, grouped by category.

### Session & status

| Tool                    | Effect                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `vibedoc_read_memory`   | Read `MEMORY.md` (+ the latest auto episode newer than it) — triggers "session start" in the activity feed |
| `vibedoc_update_memory` | Write end-of-session summary and handoff note                    |
| `vibedoc_memory_history` | List earlier `MEMORY.md` versions, read one, or restore it (undoable) |
| `vibedoc_save_entry`    | Save a long-lived fact as `memory/entries/E001-*.md` (listed at session start) |
| `vibedoc_delete_entry`  | Delete a knowledge entry that is no longer true                  |
| `vibedoc_recall`        | Search entries by keyword → compact list (id, type, summary)     |
| `vibedoc_get_entries`   | Fetch full entries by id (max 20); updates `memory/.recall-log.json` |
| `vibedoc_import_memory` | Import Claude Code memory into entries (`source: "claude-code"`); preview unless `apply: true` |
| `vibedoc_export_memory` | Write the entries into a managed block in `AGENTS.md` (and `CLAUDE.md` if it exists) for Cursor, Codex, … |
| `vibedoc_get_status`    | Board snapshot — active tasks, blockers, doc count, frontend app |
| `vibedoc_get_frontend`  | The project's web app: dir, framework, start command, URL, source |
| `vibedoc_get_sessions`  | Recent sessions: who, when, tasks moved, docs changed, ADRs      |

### Tasks

| Tool                  | Effect                                                  |
| --------------------- | ------------------------------------------------------- |
| `vibedoc_list_tasks`  | Full kanban board, filterable by status                 |
| `vibedoc_get_task`    | Read a specific task with scope and acceptance criteria |
| `vibedoc_get_evidence` | A task's evidence: each checklist item's run result, screenshots, video, run history |
| `vibedoc_update_task` | Move task status → **you see it live in the browser**; optional `manualTests` checklist |
| `vibedoc_next_task`   | Claim the next ready task of an epic (deps done) → in-progress |
| `vibedoc_verify_context` | What a finished task was asked to do + the diff of its commits, to check it |
| `vibedoc_report_findings` | Save verification findings (critical / major / minor) on a task |

### Docs

| Tool                     | Effect                                 |
| ------------------------ | -------------------------------------- |
| `vibedoc_list_docs`      | Discover all docs grouped by section   |
| `vibedoc_read_doc`       | Load any doc by name; ends with a `## Related files` footer (links to, linked from, broken) |
| `vibedoc_search_docs`    | Full-text search across all docs       |
| `vibedoc_list_specs`     | Capability specs (`docs/specs/*.md`) with requirement counts |
| `vibedoc_get_spec`       | One capability spec, or one requirement with its scenarios |
| `vibedoc_spec_context`   | Everything written about a capability (epics, done tasks, docs, entries) to draft its spec |
| `vibedoc_write_doc`      | Write or overwrite a doc file          |
| `vibedoc_create_doc`     | Create a doc from a template           |
| `vibedoc_append_doc`     | Append content to an existing doc      |
| `vibedoc_rename_doc`     | Move or rename a doc                   |
| `vibedoc_delete_doc`     | Delete a doc                           |
| `vibedoc_set_doc_priority` | Set or clear a doc's P0–P3 priority (frontmatter) |
| `vibedoc_list_templates` | List available doc templates with IDs  |
| `vibedoc_propose_edit`   | Propose edits as a diff; the user accepts or rejects in the UI |

### Context & registry

| Tool                       | Effect                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `vibedoc_get_context`      | Bundle multiple docs into a single context block            |
| `vibedoc_get_file_map`     | Structured map of all docs with descriptions and dates      |
| `vibedoc_read_registry`    | Read `docs/REGISTRY.md` — file tree + annotations           |
| `vibedoc_rebuild_registry` | Regenerate `REGISTRY.md` after adding or removing docs      |
| `vibedoc_annotate_doc`     | Update description and keywords for one doc in the registry |

### Decisions

| Tool                   | Effect                                         |
| ---------------------- | ---------------------------------------------- |
| `vibedoc_log_decision` | Write a new Architecture Decision Record (ADR) |

### Roadmap

| Tool                          | Effect                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| `vibedoc_get_roadmap`         | Horizons with nested features, statuses, and linked tasks  |
| `vibedoc_create_roadmap_item` | Create a horizon or a feature under a horizon              |
| `vibedoc_update_roadmap_item` | Change title, parent, status, order, tasks, or body        |

### Planning (agent chat)

| Tool                         | Effect                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `vibedoc_get_planning_guide` | Load the steps for planning a roadmap or breaking down an epic         |
| `vibedoc_ask_questions`      | Show 1–4 multiple-choice questions as a card; answers come next turn   |
| `vibedoc_propose_plan`       | Propose tasks or horizons/epics; the user unchecks and accepts in the UI |

A pasted spec (**Plan from spec** on `/roadmap`) or a doc (the list icon in a doc's header) can also become tasks, under a new epic, an existing one, or no epic.

None of the planning tools write files. Accept in the UI writes the plan. See [Planning from chat](docs/architecture/mcp-tools.md#planning-from-chat).

---

## Recommended CLAUDE.md snippet

Add this to your project's `CLAUDE.md` to guide your AI agent:

```markdown
## Session protocol

**Start of session:**

1. Call `vibedoc_read_memory` — read handoff from last session. If it shows `⚠ Memory warnings`, fix the handoff with `vibedoc_update_memory` before starting work
2. Call `vibedoc_get_status` — check what's active and blocked

**Before working on a task:**

- Call `vibedoc_get_task <id>` — read full spec and acceptance criteria
- Call `vibedoc_update_task <id> in-progress`
- Working through an epic? Call `vibedoc_next_task { epic: "R037" }` instead — it claims the next ready task; repeat after marking it done

**When making architectural decisions:**

- Call `vibedoc_log_decision` — record it as an ADR

**End of session:**

- Call `vibedoc_update_task` for each task touched
- Call `vibedoc_save_entry` for each fact that should outlast the session (convention, gotcha, decision, preference)
- Call `vibedoc_update_memory` with full summary and handoff note
- (If a session ends without it, VibeDoc saves an automatic episode in `.vibedoc/episodes/` and the next `vibedoc_read_memory` shows it. It is a safety net, not a replacement.)
```

---

## Project structure

VibeDoc reads from your project directory. None of these files are required — VibeDoc shows what it finds.

```
your-project/
├── CLAUDE.md                     ← agent instructions
├── docs/
│   ├── architecture/
│   │   ├── 01-overview/
│   │   ├── 02-high-level-design/
│   │   │   └── HLD.md
│   │   ├── 03-services/
│   │   │   └── user-service/
│   │   │       ├── OVERVIEW.md
│   │   │       ├── API.md
│   │   │       └── EVENTS.md
│   │   └── decisions/
│   │       └── ADR-001-*.md
│   └── REGISTRY.md               ← auto-generated file index
├── plans/tasks/
│   ├── T001-scaffold.md          ← **Status:** 📋 Ready
│   └── T002-auth.md
└── memory/
    ├── MEMORY.md                 ← session handoff
    ├── .cleanup.json             ← dismissed Cleanup flags (written by VibeDoc)
    ├── .recall-log.json          ← last vibedoc_get_entries date per entry (written by VibeDoc)
    └── entries/
        └── E001-only-core-ts-touches-fs.md   ← one long-lived fact (**Type:**, **Updated:**, **By:**)
```

---

## Multi-project

VibeDoc auto-discovers sibling directories that contain `CLAUDE.md` or `docs/architecture/`.  
Switch between projects using the dropdown in the top bar.

---

## Activity log

Every AI and human action is appended to `.vibedoc-activity.json` in your project root (last 2000 events are kept).

The Activity tab opens on **Sessions**: one card per agent or human session with who, when, how long, a headline (`3 tasks moved (2 done) · 2 docs changed · 1 ADR`) and clickable task, doc and ADR chips. Expand a card to see its raw events; **All events** shows the flat feed. Both update live via SSE.

A session is the events one actor makes without a 30-minute break, and `vibedoc_read_memory` (session start) always opens a new one. From a task's detail panel, the **Sessions** list shows every session that moved the task and jumps to that card in the Activity tab. Agents read the same timeline with `vibedoc_get_sessions`.

A session that ends without a `vibedoc_update_memory` handoff still leaves a summary: VibeDoc writes `.vibedoc/episodes/<sessionId>.md` (what happened, where it stopped, what's open) when a chat turn ends, when an epic run ends, or later at the next session start, and the next `vibedoc_read_memory` shows the newest one under **Since the last handoff**. Episodes never touch `MEMORY.md`.

---

## Screenshots and video

Browser tests that use VibeDoc's fixture record each step's screenshot and a video of the run. `vibedoc_get_frontend` copies it into your app as a test kit (`<testDir>/vibedoc/kit/`, commit it with the specs; `vibedoc/playwright` is the same fixture for installs that depend on `vibedoc`):

```ts
import { test } from './kit/testing/playwright-fixture'   // a spec in <testDir>/vibedoc/
test.use({ vibedocTask: 'T138' })            // or env VIBEDOC_TASK_ID
test('T138', async ({ page, step }) => {
  await step('Open /board → board loads', async () => { await page.goto('/board') })
})
```

Files go to `~/.vibedoc/runs/<project>/<taskId>/<runId>/` (`NN-<step>.png`, `video.webm`, `run.json`), outside the repo. `VIBEDOC_RUNS_DIR` moves that root (set it for the VibeDoc server too). Only the newest `runs.keep` runs per task are kept (`.vibedoc/settings.json`, default 5; `VIBEDOC_RUNS_KEEP` overrides). To re-run a task's spec without a terminal, press **Run tests** on `/manual-tests` (or Run in the task panel, or the play button on its card): VibeDoc reuses or starts the app, streams each step live, ticks the automated checklist items as they pass, and writes the result into the task (`Auto: passed|failed`). One run per project at a time; Stop cancels it. The **Suite** tab on `/manual-tests` runs the spec of every done task in one Playwright run (`u`), so a change that breaks an old feature shows up with the task that owned it: broken tasks first, with the failing step, error and screenshot. Tests are checked for honesty: a step with no `expect` on the page (or only `expect(true)`-style ones), or one that still passes after a passing Run replays it against a blank page, is **unverified**: its item isn't ticked, the header reads `Auto: passed · N unverified`, and review flags it. The task panel's **Runs** section shows the latest run: step thumbnails with ✓/✗, the video, and a picker for older kept runs. More in [Getting started](docs/getting-started.md#6-screenshots-and-video).

---

## Development

```bash
git clone https://github.com/quanghoangf/vibedoc.git
cd vibedoc
pnpm install
VIBEDOC_ROOT=/path/to/test-project pnpm dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for architecture rules, commit conventions, and how to submit a PR.

---

## Requirements

- **Node.js 18+**
- No database, no cloud, no accounts — reads your local file system

---

## Tech stack

- **Next.js** (App Router)
- **Tailwind CSS** — dark theme
- **SSE** (`/api/events`) — real-time browser updates
- **MCP over HTTP** (`/api/mcp`) — JSON-RPC 2.0
- **File system** — reads your actual repo, no database

---

## Contributing

Pull requests are welcome. Check [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup, architecture rules, and commit conventions. For ideas and questions, open a [Discussion](https://github.com/quanghoangf/vibedoc/discussions).

---

## License

MIT
