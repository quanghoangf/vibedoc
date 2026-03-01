# Domain Map
**Last updated:** 2025-02-28

## Bounded contexts

```mermaid
graph TB
    subgraph VibeDoc["VibeDoc Process"]
        WebUI["Web UI (browser)<br/>Kanban<br/>Docs viewer<br/>Activity<br/>Memory"]
        MCP["MCP Server<br/>/api/mcp<br/>10 tools<br/>JSON-RPC"]
        SSE["SSE Bus<br/>/api/events<br/>emitUpdate<br/>singleton"]

        API["API Routes<br/>/api/tasks /api/docs<br/>/api/memory /api/decisions<br/>/api/activity /api/projects"]

        Core["src/lib/core.ts<br/>(file system ops)"]

        MCP -.->|reads| WebUI
        WebUI --> API
        MCP --> API
        SSE --> API
        API --> Core
    end

    Project["Target Project (your repo)<br/>CLAUDE.md<br/>plans/tasks/*.md<br/>docs/**/*.md<br/>memory/MEMORY.md<br/>.vibedoc-activity"]

    Core --> Project
```

## Data ownership
| Domain | Owner | Storage | Format |
|--------|-------|---------|--------|
| Tasks | Target project | `plans/tasks/T*.md` | Markdown with frontmatter-style `**Key:** Value` |
| Docs | Target project | `docs/**/*.md` | Markdown |
| Memory | Target project | `memory/MEMORY.md` | Markdown |
| ADRs | Target project | `docs/architecture/decisions/ADR-*.md` | Markdown |
| Activity log | Target project | `.vibedoc-activity.json` | JSON array (500 events max) |
| Project config | VibeDoc env | `.env.local` | `VIBEDOC_ROOT=<path>` |

## Key relationships
- **Web UI ↔ API Routes:** Browser fetches `/api/*` and subscribes to `/api/events` (SSE)
- **MCP Server ↔ API Routes:** MCP handler calls same `core.ts` functions as API routes — no duplication
- **API Routes → SSE Bus:** After every mutation, API route calls `emitUpdate()` → browser refreshes
- **core.ts ↔ File System:** Single module owns all file I/O. Everything else imports from it.
