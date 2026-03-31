# VibeDoc

**Local-first project intelligence for AI-assisted development.**

A kanban board + docs viewer + MCP server — all in one process.
When your AI moves a task, you see it in the browser — live.

```
http://localhost:3000         ← your browser (kanban, docs, activity, memory)
http://localhost:3000/api/mcp ← AI agent connects here via MCP
```

---

## Quick start

```bash
# Run from inside your project directory
cd your-project
npx vibedoc
```

That's it. VibeDoc uses the current directory as the project root and opens at `http://localhost:3000`.

VibeDoc automatically finds a free port starting from 3000, so it won't conflict with other running services.

### Options

```bash
# Point at a different project
VIBEDOC_ROOT=/path/to/project npx vibedoc

# Pin to a specific port
PORT=4000 npx vibedoc
```

---

## Connect your AI agent

### Claude Code (`~/.claude/claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "vibedoc": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### Cursor (`.cursor/mcp.json` in project root)
```json
{
  "mcpServers": {
    "vibedoc": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### Windsurf (`~/.codeium/windsurf/mcp_config.json`)
```json
{
  "mcpServers": {
    "vibedoc": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

---

## What the AI can do

| Tool | Effect |
|------|--------|
| `vibedoc_read_memory` | Reads MEMORY.md. Also triggers "session start" in activity feed. |
| `vibedoc_get_status` | Board snapshot — active tasks, blockers, doc count |
| `vibedoc_list_tasks` | Full kanban board |
| `vibedoc_get_task` | Read a specific task with scope + criteria |
| `vibedoc_update_task` | Move task status → **you see it live in browser** |
| `vibedoc_read_doc` | Load any doc: `"CLAUDE"`, `"HLD"`, `"user-service/API"` |
| `vibedoc_list_docs` | Discover all docs by section |
| `vibedoc_search_docs` | Full-text search across all docs |
| `vibedoc_log_decision` | Write a new ADR → appears in docs immediately |
| `vibedoc_update_memory` | Write end-of-session summary → updates Memory tab |

---

## Recommended CLAUDE.md snippet

Add this to your project's `CLAUDE.md` to guide your AI agent:

```markdown
## Session protocol

**Start of session:**
1. Call `vibedoc_read_memory` — read handoff from last session
2. Call `vibedoc_get_status` — check what's active and blocked

**Before working on a task:**
- Call `vibedoc_get_task <id>` — read full spec and acceptance criteria
- Call `vibedoc_update_task <id> in-progress`

**When making architectural decisions:**
- Call `vibedoc_log_decision` — record it as an ADR

**End of session:**
- Call `vibedoc_update_task` for each task touched
- Call `vibedoc_update_memory` with full summary and handoff note
```

---

## Project structure

VibeDoc reads from your project. Create these files to get the most out of it:

```
your-project/
├── CLAUDE.md                     ← agent instructions
├── docs/architecture/
│   ├── 01-overview/
│   ├── 02-high-level-design/
│   │   └── HLD.md
│   ├── 03-services/
│   │   └── user-service/
│   │       ├── OVERVIEW.md
│   │       ├── API.md
│   │       └── EVENTS.md
│   └── decisions/
│       └── ADR-001-*.md
├── plans/tasks/
│   ├── T001-scaffold.md          ← **Status:** 📋 Ready
│   └── T002-auth.md
└── memory/
    └── MEMORY.md
```

None of these are required — VibeDoc will show what it finds.

---

## Multi-project

VibeDoc auto-discovers sibling directories that contain `CLAUDE.md` or `docs/architecture/`.
Switch between projects using the dropdown in the top bar.

---

## Activity log

All AI and human actions are appended to `.vibedoc-activity.json` in your project root.
The Activity tab shows the last 30 events in real time via SSE.

---

## Tech stack

- **Next.js 14** (App Router)
- **Tailwind CSS** — dark theme, no component library
- **SSE** (`/api/events`) — real-time browser updates
- **MCP over HTTP** (`/api/mcp`) — JSON-RPC 2.0
- **File system** — reads your actual repo, no database
