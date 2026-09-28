# Core Library — Overview
**File:** `src/lib/core.ts`
**Last updated:** 2025-02-28

## Purpose
Single module that owns all file system access. Shared by:
- All `/api/*` route handlers
- The MCP tool handler in `/api/mcp/route.ts`

Nothing outside `core.ts` calls `fs` directly.

## Function groups

### Project detection
```typescript
findRoot(startDir?)        // walk up from dir, find CLAUDE.md / docs/architecture
getConfiguredRoot()        // reads VIBEDOC_ROOT env var, falls back to cwd
discoverProjects(base?)    // scan sibling dirs for vibedoc projects
```

### Documents
```typescript
listDocs(root)             // glob all *.md, group by section
readDoc(query, root)       // flexible lookup: name, path fragment, glob
searchDocs(query, root)    // full-text search, returns hits with line numbers
```

### Tasks
```typescript
listTasks(root)            // parse all T*.md into Task[], build TaskBoard
getTask(taskId, root)      // find + parse specific task
updateTaskStatus(...)      // rewrite **Status:** line in .md file
```

### Memory
```typescript
readMemory(root)           // read memory/MEMORY.md
updateMemory(params, root) // write full MEMORY.md with structured params
```

### Decisions
```typescript
logDecision(params, root)  // create ADR-NNN-*.md, update _INDEX.md
```

### Activity
```typescript
readActivity(root, limit)  // read .vibedoc-activity.json
appendActivity(root, event) // append to activity log (private — called by other core fns)
logSessionStart(root)      // convenience: append session_start event
```
`appendActivity` stamps each event with a `sessionId` and keeps the newest 2000 events.

### Sessions (`src/lib/sessions.ts`, pure — no fs)
```typescript
groupSessions(events, { gapMs? })  // activity → Session[] newest first (sessionId, else 30-min actor gap / session_start)
sessionsForTask(sessions, taskId)  // sessions that moved a task
sessionDuration(session)           // "<1m" | "12m" | "1h 35m"
```

### Summary
```typescript
getProjectSummary(root)    // combined: tasks + docs + memory + recent activity
```

## Task file format expected
```markdown
# T001: Title Here
**Status:** 📋 Ready
**Phase:** 0 — Foundation
**Size:** M (2-4 hrs)
**Depends on:** —

## What to build
...

## Acceptance criteria
- [ ] criterion

## Definition of done
...
```

`updateTaskStatus` finds and replaces the `**Status:** ...` line.
Status values: `todo`, `in-progress`, `done`, `blocked`, `cancelled`
Icons mapped automatically: `📋 🔨 ✅ 🚫 ❌`
