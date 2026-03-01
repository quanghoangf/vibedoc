# Project Memory
**Last updated:** 2026-03-01

## Current state
URL-based routing complete. Each tab now has its own route (`/board`, `/docs`, `/activity`, `/memory`). Build and lint pass clean.

**T005 (markdown rendering) is RESOLVED** — `MarkdownRenderer` now uses `marked.parse()` with GFM + sanitization.

## Just completed
- **URL routing refactor:** `src/app/page.tsx` is now a server redirect to `/board`
- `src/app/(app)/layout.tsx` — route group layout wrapping all tab routes with AppProvider + AppShell
- `src/context/AppContext.tsx` — shared state + SSE + hooks (`useApp`)
- 4 route pages: `(app)/board/page.tsx`, `(app)/docs/page.tsx`, `(app)/activity/page.tsx`, `(app)/memory/page.tsx`
- `AppSidebar` updated: uses `Link` + `usePathname()` for active state; removed `activeTab`/`onTabChange` props
- `TabId` type removed from `src/types/index.ts` (replaced by routes)
- Docs page owns its own `docs`/`docSearch` local state (not in context)

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
    board/           BoardTab, BoardColumn, TaskCard, TaskDetailPanel (placeholder)
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
Nothing. Ready for T003.

## Up next
1. **T003** — Task detail panel (click task → slide-in dialog; scaffold is in TaskDetailPanel.tsx)
2. **T001** — Drag-and-drop kanban (HTML5 native DnD)
3. **T002** — Inline doc editor
4. **T004** — Keyboard shortcuts (depends on T003)
5. **T006** — Task creation form

## Active issues
| Issue | Severity | Status |
|-------|----------|--------|
| No error boundaries in UI — API failures fail silently | low | open |
| Multi-project scanning is naive (reads all siblings) | low | open |

## Tech debt
- TaskDetailPanel.tsx is a placeholder (returns null) — T003 implements it
- No error boundaries in UI — API failures fail silently
- Multi-project scanning is naive (reads all siblings) — needs a depth limit

## Key conventions
- **Package manager: pnpm** (pnpm-lock.yaml present; npm fails with lock conflict)
- Shared state in AppContext, passed via `useApp()` — no prop drilling
- Docs-page-local state (`docs`, `docSearch`) stays in `(app)/docs/page.tsx`
- `cn()` from `@/lib/utils` for all class merging
- Types from `@/types` (re-exports core.ts types + UI-specific types)
- `emitUpdate()` called after all mutations — never from core.ts

## Handoff for next session
App routes correctly. Start with **T003** (task detail panel) — `TaskDetailPanel.tsx` is the scaffold (returns null). Wire it up as a shadcn Dialog opened when the user clicks a task card. In `(app)/board/page.tsx`, `openDoc` currently navigates to /docs — T003 should instead open a task detail dialog. Look at how `TaskCard.onOpen` → `BoardColumn` → `BoardTab` → `board/page.tsx` currently calls `openDoc`.
