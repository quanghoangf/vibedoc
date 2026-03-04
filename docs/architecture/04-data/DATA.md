# Data Architecture
**Last updated:** 2025-02-28

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
| `.vibedoc-activity.json` | `appendActivity()` | JSON array, prepend, max 500 |

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
    "taskStatus": "done"
  }
]
```
`type` values: `task_updated` | `decision_logged` | `memory_updated` | `doc_read` | `session_start`
`actor` values: `ai` | `human`

## Task file parsing rules
- Title: first `# ` line, strips `T001: ` prefix
- Status: first `**Status:** ...` line within first 30 lines
- Size, Phase, Depends on: same `**Key:** Value` pattern
- Task ID: from filename `T001-*` → `T001`
- Raw content: kept for rewrite operations

## Multi-project
Each project is completely independent — its own file paths, its own activity log.
`VIBEDOC_ROOT` env var sets the active project. Project switcher in UI calls `/api/projects` which scans siblings.
