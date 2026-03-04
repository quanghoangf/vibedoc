# VibeDoc — Development Plan
**Last updated:** 2025-02-28

## Phase 0 — Foundation ✅ (complete)
Core app is running. 4 tabs work. MCP endpoint live.

- ✅ Next.js 14 scaffold (App Router, TypeScript, Tailwind)
- ✅ `src/lib/core.ts` — all file system ops
- ✅ `src/lib/events.ts` — SSE event bus
- ✅ `/api/mcp` — 10 MCP tools via JSON-RPC
- ✅ `/api/events` — SSE stream
- ✅ `/api/tasks`, `/api/docs`, `/api/memory`, `/api/decisions`, `/api/activity`
- ✅ Board tab — kanban with quick status actions
- ✅ Docs tab — file tree + markdown viewer + search
- ✅ Activity tab — real-time feed
- ✅ Memory tab — MEMORY.md renderer
- ✅ Project switcher — multi-project dropdown
- ✅ Live indicator

## Phase 1 — Polish the core UX (current)
Make the existing features feel great and fix rough edges.

- [ ] T001 — Drag-and-drop kanban board
- [ ] T002 — Inline doc editor (edit markdown in browser)
- [ ] T003 — Task detail panel (click task → slide-in panel with full content)
- [ ] T004 — Keyboard shortcuts (k/d/a/m for tabs, j/k for navigation)
- [ ] T005 — Better markdown rendering (use `marked` + sanitize properly)

## Phase 2 — Create from UI
Let humans do what only AI can do today.

- [ ] T006 — Task creation form (new task from UI)
- [ ] T007 — ADR creation form (currently AI-only)
- [ ] T008 — Session controls (Start Session / End Session buttons that call MCP tools)
- [ ] T009 — Memory editor (edit MEMORY.md directly from UI)

## Phase 3 — Power features
- [ ] T010 — Activity filter (filter by actor: AI/human, type: task/decision/memory)
- [ ] T011 — Doc full-text search with highlighted results
- [ ] T012 — Task dependency graph (visualize dependsOn relationships)
- [ ] T013 — Time tracking (record how long tasks spend in each status)
- [ ] T014 — Export: generate context bundle for AI (CLAUDE.md + current tasks + memory as single prompt)

## Phase 4 — Team / self-hosting
- [ ] T015 — Multi-user activity (who moved what)
- [ ] T016 — Docker image + docker-compose for self-hosting
- [ ] T017 — SQLite mode (optional: persist activity to DB for large teams)
- [ ] T018 — Notifications (browser notifications on blocked tasks)

## MVP definition (Phase 1 complete)
- Drag-and-drop kanban feels good
- Can edit docs without leaving the browser
- Task detail panel shows full spec
- `npm run build` passes clean
