# Project Memory
**Last updated:** 2026-09-28

## Current state
**All 28 tasks are ✅ Done. T006 (task creation form) is ❌ Cancelled.**

The full feature set is complete: URL routing, kanban board, task detail panel, doc viewer, markdown rendering, collapsible sidebar, header polish, editor toolbar/tabs, doc list polish, board card polish, agent config view, context bundler, command palette, doc outline panel, backlinks panel, MCP tools extended, CLI wizards, and more.

## Component structure
```
src/
  context/
    AppContext.tsx    ← AppProvider, useApp hook, shared state + SSE
  app/
    page.tsx          ← server redirect → /board
    (app)/
      layout.tsx      ← AppProvider + AppShell wrapper
      board/page.tsx
      docs/page.tsx
      activity/page.tsx
      memory/page.tsx
  components/
    ui/              ← shadcn generated (9 files)
    shared/          LoadingScreen, EmptyState
    layout/          AppShell, AppHeader, AppSidebar (Link-based), ProjectSwitcher, LiveIndicator, StatsPills
    board/           BoardTab, BoardColumn, TaskCard, TaskDetailPanel
    docs/            DocsTab, DocList, DocViewer, MarkdownRenderer
    activity/        ActivityTab, ActivityFeed, ActivityEventRow
    memory/          MemoryTab
```

## Context interface (AppContext)
```typescript
{ projects, activeProject, summary, board, activity, liveIndicator, loading,
  selectedDoc, setSelectedDoc, rootParam, onProjectChange, refresh, moveTask, openDoc }
```
- `refresh()` fetches summary + tasks + activity (NOT docs)
- `openDoc()` fetches doc, sets selectedDoc, calls `router.push('/docs')`
- Docs page fetches its own doc list

## Working on now
Branch `feat/roadmap` (on top of `chore/upgrade-deps`: Next 16, Tailwind 4, ESLint 9 flat config).
Roadmap page `/roadmap` — roadmap.sh-style map built with `@xyflow/react`. Design notes: `01-brainstorm/roadmap-page.md`.

## Up next
- Fix the 16 pre-existing react-hooks lint errors

## Active issues
| Issue | Severity | Status |
|-------|----------|--------|
| No error boundaries in UI — API failures fail silently | low | open |
| Multi-project scanning is naive (reads all siblings) | low | open |

## Tech debt
- No error boundaries in UI — API failures fail silently
- Multi-project scanning is naive (reads all siblings) — needs a depth limit

## Key conventions
- **Package manager: pnpm** (pnpm-lock.yaml present; npm fails with lock conflict)
- Shared state in AppContext, passed via `useApp()` — no prop drilling
- Docs-page-local state (`docs`, `docSearch`) stays in `(app)/docs/page.tsx`
- `cn()` from `@/lib/utils` for all class merging
- Types from `@/types` (re-exports core.ts types + UI-specific types)
- `emitUpdate()` called after all mutations — never from core.ts
- Roadmap items: `plans/roadmap/R*.md` (`**Parent:**` omitted = horizon, `**Status:**` planned|in-progress|done, `**Order:**`, `**Tasks:**`). Max depth 2.
- Roadmap positions live ONLY in `plans/roadmap/layout.json` — never x/y in R*.md. Missing entries are auto-placed (`components/roadmap/layout.ts`).
- Roadmap writes are serialized by an in-process lock (`withRoadmapLock` in core.ts); SSE event name `roadmap_updated`; the roadmap page opens its own EventSource.
- Roadmap progress/drift is derived, never stored: `src/lib/roadmap-health.ts` (pure; used by the page via AppContext `board` and by MCP `vibedoc_get_roadmap` / the hint after `vibedoc_update_task`). Self-check: `node src/lib/roadmap-health.check.mts`.
- Roadmap `**Due:** YYYY-MM-DD` is optional and a local calendar date, not an instant: compare as strings, never `new Date("YYYY-MM-DD")` (UTC shift). `localToday()` / `dueState()` in `roadmap-health.ts`; overdue-and-not-done shows in the "Needs attention" panel.
- `/roadmap?view=timeline` = month-axis Timeline (`components/roadmap/timeline.ts` pure layout, `RoadmapTimeline.tsx`); Map is the default view.
- `ROADMAP.md` is now only a pointer to `plans/roadmap/`.
- Lint: 16 pre-existing `react-hooks` errors (React Compiler rules) outside roadmap files — don't add new ones.

## Handoff for next session
All tasks complete. Start by discussing what's next — new features, a v2 roadmap, or publishing/packaging work.
