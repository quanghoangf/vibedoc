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
**Agent chat sidebar** (branch `spartan-hoangnguyen/agent-chat`, brainstorm in `01-brainstorm/agent-chat-sidebar.md`):
- `POST /api/chat` spawns `claude -p --output-format stream-json` per turn (OpenClaw pattern), billed to the local Claude Code login. `ANTHROPIC_API_KEY` is stripped from the child env. `--tools ""` + `--strict-mcp-config`, so only `mcp__vibedoc__*` tools; write/append/delete are disallowed.
- The agent edits via `vibedoc_propose_edit` with `edits: [{old_string, new_string}]` (Claude Code Edit semantics: exact, unique match, applied in order; empty old_string = new doc). Validated server-side (dry run) so the agent retries bad matches. `ChatPanel` shows a diff (`src/lib/diff.ts`); Accept → `PUT /api/docs` with `{edits, actor: "ai"}` → `core.editDoc()` re-applies the spans to the current file.
- `doc_updated` with `actor: "ai"` is applied span-by-span into the open Yjs buffer (`MarkdownEditor`), so the user's unsaved typing elsewhere survives. Only the tab with the lowest Yjs clientID applies it. Whole-file writes from other agents (`write_doc`) splice in only the differing middle.
- `/api/mcp` now honors `?root=`.
- Known ceilings: one process spawn per turn (~1–2s); no Stop button; if the user edits inside the exact span the agent targets, Accept fails with "doc changed" and the agent must re-propose.

## Up next
No open tasks. Ready for new feature planning or v2 roadmap.

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

## Handoff for next session
All tasks complete. Start by discussing what's next — new features, a v2 roadmap, or publishing/packaging work.
