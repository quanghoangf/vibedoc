# Data Architecture
**Last updated:** 2026-09-28

## No database — intentional

VibeDoc reads and writes your actual project files. No sync, no import, no database to maintain.

## Files VibeDoc reads (never modifies)
| File | Used for |
|------|---------|
| `CLAUDE.md` / `AGENTS.md` | Project root detection marker |
| `docs/**/*.md` | Doc browser, search |
| `plans/tasks/T*.md` | Task parsing, kanban board |

## Files VibeDoc writes
| File | Written by | Format |
|------|-----------|--------|
| `plans/tasks/T*.md` | `updateTaskStatus()` | Replaces `**Status:**` line only |
| `memory/MEMORY.md` | `updateMemory()` | Full overwrite |
| `docs/architecture/decisions/ADR-*.md` | `logDecision()` | Creates new file |
| `docs/architecture/decisions/_INDEX.md` | `logDecision()` | Appends row |
| `.vibedoc-activity.json` | `appendActivity()` | JSON array, prepend, max 2000 |

## Activity log schema
```json
[
  {
    "id": "evt_1234567890_abc12",
    "timestamp": "2025-02-28T14:32:00.000Z",
    "type": "task_updated",
    "actor": "ai",
    "title": "T003 moved to done",
    "detail": "Implement user authentication",
    "taskId": "T003",
    "taskStatus": "done",
    "sessionId": "ses_1790587370058_tzmkg"
  }
]
```
`type` values: `task_updated` | `decision_logged` | `memory_updated` | `doc_read` | `session_start` | `doc_created` | `doc_deleted` | `doc_renamed` | `registry_rebuilt` | `roadmap_updated`
`actor` values: `ai` | `human`

## Sessions
Sessions are derived when read, never stored (`src/lib/sessions.ts`, pure).
- **New events** carry `sessionId`. `appendActivity()` keeps the current session per root + actor in memory and starts a new one on `session_start`, when the actor has none, or after a 30-minute gap. A server restart starts a new session.
- **Legacy events** (no `sessionId`) are grouped per actor: a `session_start` or a gap of more than 30 minutes starts a new session.
- Each session summarizes tasks moved (last status per task), docs changed (`doc_created` / `doc_deleted` / `doc_renamed`; `doc_read` is not a change), ADRs (`decision_logged`), roadmap edits, and whether memory was updated, into a `headline`.
- Served by `GET /api/sessions?taskId=&limit=` and the MCP tool `vibedoc_get_sessions`.

## Task file parsing rules
- Title: first `# ` line, strips `T001: ` prefix
- Status: first `**Status:** ...` line within first 30 lines
- Size, Phase, Depends on: same `**Key:** Value` pattern
- Task ID: from filename `T001-*` → `T001`
- Raw content: kept for rewrite operations

## Multi-project
Each project is completely independent — its own file paths, its own activity log.
`VIBEDOC_ROOT` env var sets the active project. Project switcher in UI calls `/api/projects` which scans siblings.
