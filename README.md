# VibeDoc

**Local-first project intelligence for AI-assisted development.**

A Next.js app that is both your kanban board and your AI agent's MCP server.
When your AI moves a task, you see it in the browser — live.

```
http://localhost:3000        ← your browser (kanban, docs, activity, memory)
http://localhost:3000/api/mcp ← AI agent connects here via MCP
```

---

## Quick start

```bash
# 1. Clone / copy this folder next to your project
cd vibedoc-app
npm install

# 2. Point at your project
cp .env.example .env.local
# Edit VIBEDOC_ROOT to your project path

# 3. Start
npm run dev
# → http://localhost:3000
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

## Multi-project

VibeDoc auto-discovers projects by scanning sibling directories for `CLAUDE.md` or `docs/architecture/`.
Switch projects using the dropdown in the top bar.

To override the scan base:
```env
VIBEDOC_ROOT=/my/main/project
```

---

## Project structure expected

```
your-project/
├── CLAUDE.md                     ← agent instructions
├── docs/architecture/
│   ├── 01-overview/
│   ├── 02-high-level-design/
│   │   └── EVENT_CATALOG.md
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

---

## Activity log

All AI and human actions are written to `.vibedoc-activity.json` in your project root.
The Activity tab shows the last 30 events in real time (SSE).

---

## Tech stack

- **Next.js 14** (App Router)
- **Tailwind CSS** — dark theme, no component library
- **SSE** (`/api/events`) — real-time browser updates
- **MCP over HTTP** (`/api/mcp`) — JSON-RPC 2.0
- **File system** — reads your actual repo, no database
