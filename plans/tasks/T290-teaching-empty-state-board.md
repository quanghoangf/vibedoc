# T290: Teaching EmptyState, copy-command and agent seam, on the board
**Status:** 👀 Review
**Phase:** R083 — Teaching empty states
**Size:** M (2–3 hrs)
**Covers:** S1, S2, S3, S4
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
A board with no tasks says what fills it and gives one action, instead of "No tasks match these filters". This task builds the shared pieces every later page reuses.

## Context
- Epic: `plans/roadmap/R083-teaching-empty-states.md`
- Today the board's four views show `board.noMatch` / `noMatchHint` ("Remove a filter…") even when the project has no tasks at all (`BoardView.tsx:68`, `TableView.tsx:63`, `EpicView.tsx:79`, `TimelineView.tsx:205`).
- **Seam for R081 (Connect your agent):** "connected" = the activity log has an event with `actor: "ai"` (same signal as the header `ConnectMenu`'s "Last agent call", `AppHeader.tsx:200`). The Connect link is `/getting-started#3-connect-your-agent` (the guide's "Connect your agent" heading; MarkdownRenderer gives headings ids). Both live in ONE place (`useAgentConnected()` + `CONNECT_HREF`) so R081 swaps them for its live status and panel. Don't build R081's panel.
- Out of R083: sample data (R085), tours/tooltips.
- Built: `src/components/shared/agent-connection.ts` holds the R081 seam (`useAgentConnected`, `CONNECT_HREF`). `src/app/welcome/CopyCommand.tsx` is now a one-line re-export, so R082's welcome page needs no change.
- CLAUDE.md: no hardcoded UI text, `src/i18n/<area>.ts` (`en` + typed `vi`), `useT()`. Commands (`/vibedoc:roadmap`) are not translated.

## Scope
- [ ] `EmptyState` (`src/components/shared/EmptyState.tsx`): props `icon` (lucide component), `title`, `lead` (what appears here and why), `action` (ReactNode: the one primary action), optional `needsAgent`. Root carries `data-empty-state`; when `needsAgent` and no agent yet, add a line "Your agent isn't connected yet. Connect it →" linking to `CONNECT_HREF` (marked `data-connect-hint`). Keep the existing two callers working (roadmap, memory) or move them over.
- [ ] Move `src/app/welcome/CopyCommand.tsx` to `src/components/shared/CopyCommand.tsx` (update the one import in `src/app/welcome/page.tsx`), translate its aria labels, add an optional `prompt` prop so a slash command shows without the `$ `.
- [ ] `useAgentConnected()` hook (e.g. `src/components/shared/agent-connection.ts`): `useApp().activity.some(e => e.actor === "ai")`, plus `CONNECT_HREF`. Comment: seam for R081.
- [ ] Board: when the project has no tasks at all (`tasks.length === 0` before filters, not `shown`), every view shows the teaching empty state instead of `noMatch`. Lead: tasks appear when an epic is broken down, and agents claim them from here. Action: copy `/vibedoc:breakdown` when the roadmap has epics, else `/vibedoc:roadmap` (fetch `/api/roadmap` once, only when there are no tasks). `needsAgent`. "New task" stays in the header.
- [ ] i18n keys in `src/i18n/shell.ts` (shared: connect line, copy labels) and `board.ts` (board copy), `en` + `vi`.
- [ ] New `e2e/empty-states.mjs` (port from `BASE`, default `http://localhost:3083`): a truly empty fixture (mkdtemp, no plans/) → `/board` has one `[data-empty-state]` with a lead and exactly one primary action, plus `[data-connect-hint]`; after one MCP call (`tools/call vibedoc_read_memory`: the tool that logs an `ai` session_start; `vibedoc_get_status` logs nothing) the hint is gone; with a roadmap epic the command reads `/vibedoc:breakdown`; in vi (cookie `vibedoc-lang=vi`) the text is Vietnamese. Structure it as a `PAGES` list later tasks extend.

**Out of scope:** other pages (T291–T293); R081's connection panel.

## Files
- `src/components/shared/EmptyState.tsx`, `src/components/shared/CopyCommand.tsx` (moved), `src/components/shared/agent-connection.ts` (new)
- `src/app/welcome/page.tsx` (import only)
- `src/components/board/BoardTab.tsx` or the four views: choose where the "no tasks at all" check goes so it's one place (BoardTab, before the view switch, is simplest)
- `src/i18n/shell.ts`, `src/i18n/board.ts`
- `e2e/empty-states.mjs` (new)

## Implementation notes
- Mark the primary action with `data-empty-action` so the e2e counts exactly one.
- Activity in AppContext is the 30 newest events; an empty project is the case that matters, so that's fine. Note it as a ponytail ceiling in the hook.
- `e2e/i18n.mjs` already walks every route on an empty project in vi: run it too, it catches untranslated text.

## Acceptance criteria
- [ ] Empty project → /board shows title, lead, one copy-command action and the connect line (all four views)
- [ ] A project with tasks but a filter that hides all → still "No tasks match these filters"
- [ ] After an agent's MCP call, the connect line disappears (live via SSE or on reload)
- [ ] vi: all text Vietnamese; `node src/lib/i18n.check.mts` passes
- [ ] Welcome page copy button still works

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3083 pnpm dev &   # then:
BASE=http://localhost:3083 PW_DIR=. node e2e/empty-states.mjs
BASE=http://localhost:3083 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
_2026-10-07 — ai · Spec: `e2e/vibedoc/T290-teaching-empty-state-board.spec.ts` · Auto: passed 2026-10-07_
### Steps
- [x] 🤖 S1 — WHEN the user opens /board in an empty project → THEN it says what fills it and offers one action
- [x] 🤖 S2 — WHEN no agent has called VibeDoc yet → THEN the empty state links to Connect
- [x] 🤖 With an epic on the roadmap → the board offers /vibedoc:breakdown
- [x] 🤖 S3 — WHEN an agent has called VibeDoc → THEN the connect line is gone
- [x] 🤖 S4 — WHEN the language is Tiếng Việt → THEN the empty state is Vietnamese
- [ ] The empty board looks right in light and dark themes and at phone width (390px): centered, the command doesn't overflow
### Regression risk
- [x] 🤖 A board with tasks whose filter hides them all → still "No tasks match these filters"
- [ ] /welcome: the `npx vibedoc` copy button still copies (CopyCommand moved to components/shared; welcome re-exports it)
