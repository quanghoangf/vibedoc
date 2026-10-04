# Project Memory
**Last updated:** 2026-09-30

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

**Agent chat sidebar** (branch `spartan-hoangnguyen/agent-chat`, brainstorm in `01-brainstorm/agent-chat-sidebar.md`):
- `POST /api/chat` spawns `claude -p --output-format stream-json` per turn (OpenClaw pattern), billed to the local Claude Code login. `ANTHROPIC_API_KEY` is stripped from the child env. `--tools ""` + `--strict-mcp-config`, so only `mcp__vibedoc__*` tools; write/append/delete doc, create_roadmap_item and delete_entry are disallowed.
- The agent edits via `vibedoc_propose_edit` with `edits: [{old_string, new_string}]` (Claude Code Edit semantics: exact, unique match, applied in order; empty old_string = new doc). Validated server-side (dry run) so the agent retries bad matches. `ChatPanel` shows a diff (`src/lib/diff.ts`); Accept → `PUT /api/docs` with `{edits, actor: "ai"}` → `core.editDoc()` re-applies the spans to the current file.
- `doc_updated` with `actor: "ai"` is applied span-by-span into the open Yjs buffer (`MarkdownEditor`), so the user's unsaved typing elsewhere survives. Only the tab with the lowest Yjs clientID applies it. Whole-file writes from other agents (`write_doc`) splice in only the differing middle.
- `/api/mcp` now honors `?root=`.
- Parallel chats (R044) + chat UI refactor: `ChatProvider` (`src/context/ChatContext.tsx`) owns every chat; each chat is its own Claude session and `claude -p` turn, up to 4 running (`MAX_RUNNING_CHATS`). One `ChatView` renders in two frames: `ChatModal` (header Agent button, `c`, item buttons) and the `/chat` page (list · conversation · `ChatContextRail`). `show(id)` opens the modal, or selects in place when already on `/chat`; Expand in the modal → `/chat?id=`. The left sidebar has an "Agents" section (needs you → running → recent). Chats attach to an epic or task (`attach: {kind, id}`): "Chat" on the roadmap epic sheet, each task row there, and the board task panel resumes that item's chat or starts one (`showAbout`); the first turn of such a chat tells the agent to read the item. The item shows the chat's status (`AgentMark`/`AgentDot`). Saved to `.vibedoc/chats/<id>.json` via `/api/conversations` (not `/api/chats`: the e2e stubs match `**/api/chat**`) at turn start, turn end and card resolution; a reload mid-turn shows it as interrupted. Empty chats aren't saved and are dropped when their modal closes. Stop = abort the fetch (`/api/chat` kills the child). Deep links: `/roadmap?item=R004`, `/board?task=T055`. Waiting chats: header badge, `(n) VibeDoc` title, desktop notification when the tab is hidden.
- Known ceilings: one process spawn per turn (~1–2s); if the user edits inside the exact span the agent targets, Accept fails with "doc changed" and the agent must re-propose.

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
- A `breakdown` plan (`vibedoc_propose_plan`) targets an existing `epic`, a `newEpic: {title, parent, body}` created on Accept, or neither (loose tasks, no Phase). Validation lives in `src/lib/plan.ts`.
- Roadmap positions live ONLY in `plans/roadmap/layout.json` — never x/y in R*.md. Missing entries are auto-placed (`components/roadmap/layout.ts`).
- Roadmap writes are serialized by an in-process lock (`withRoadmapLock` in core.ts); SSE event name `roadmap_updated`; the roadmap page opens its own EventSource.
- Roadmap progress/drift is derived, never stored: `src/lib/roadmap-health.ts` (pure; used by the page via AppContext `board` and by MCP `vibedoc_get_roadmap` / the hint after `vibedoc_update_task`). Self-check: `node src/lib/roadmap-health.check.mts`.
- At-risk is a derived drift kind (`'at-risk'`) in `roadmap-health.ts`: an epic with an overdue or blocked task, or due ≤7 days with nothing started. It reuses the map ⚠ / attention panel and tags the epic ` ⚠ at risk` in `vibedoc_get_roadmap`. Horizon progress counts tasks across its epics (untasked epic = 1 unit).
- Roadmap `**Due:** YYYY-MM-DD` is optional and a local calendar date, not an instant: compare as strings, never `new Date("YYYY-MM-DD")` (UTC shift). `localToday()` / `dueState()` in `roadmap-health.ts`; overdue-and-not-done shows in the "Needs attention" panel.
- Map "Arrange" button: `arrangePositions()` in `components/roadmap/layout.ts` (pure; check `node src/components/roadmap/layout.check.mts`) ignores saved positions, puts each horizon's epics in one column per side (measured heights, shorter side first, centred on the horizon), stacks horizon blocks without overlap, writes every position to layout.json. Nodes tween 420ms (off under reduced motion); Undo toast re-posts the previous positions.
- `/roadmap?view=timeline` = month-axis Timeline (`components/roadmap/timeline.ts` pure layout, `RoadmapTimeline.tsx`); Map is the default view.
- Empty `/roadmap` → "Generate roadmap" (`generateRoadmap()` in core.ts, pure drafting in `src/lib/roadmap-import.ts`): source = ROADMAP.md (`##` + bullets) → tasks grouped by Phase → starter Shipped/Now/Next/Later. Never touches ROADMAP.md/tasks, refuses when R*.md exist, writes layout.json once (client posts `resolvePositions`) so the map stays frozen. Self-check: `node src/lib/roadmap-import.check.mts`.
- `ROADMAP.md` is now only a pointer to `plans/roadmap/`.
- Chat logic lives in `src/lib/chats.ts` (pure: `routeAsk`, `chatStatus`, `groupChats`, `chatFor`, `itemAgents`, `toSaved`/`fromSaved`, `MAX_RUNNING_CHATS`; no React, no fs). Self-check: `node src/lib/chats.check.mts`. `routeAsk` sends an ask about an item (`epicOf`) to that item's chat (opens it, sending nothing, while it runs or waits on you), otherwise to the current chat only when it is idle and unattached; a chat waiting on the user or about another item is never written into (`e2e/epic-chat-routing.mjs`).
- Manual tests & review (R043): `vibedoc_update_task` takes an optional `manualTests` checklist → `## Manual tests` section in the task file (`src/lib/manual-tests.ts`, pure; a new report replaces the old). Card badge `🧪 done/total`, `/manual-tests` to tick (`POST /api/tasks/manual-tests`). `review` (👀) is an optional status: approve → done, send back (note) → todo, recorded in `## Review` (`src/lib/review.ts`, `POST /api/tasks/review`). Review is not a met dependency; `vibedoc_next_task` shows the send-back note first. Nothing blocks done (ADR-005). Section parsers ignore headings inside ``` fences. Checks: `node src/lib/manual-tests.check.mts`, `node src/lib/review.check.mts`, `e2e/manual-tests-review.mjs`.
- Board views: `/board` = Board · Table · By epic · Timeline + saved views. Pure logic (filter/sort/group, dep outline, timeline bars + Active-time axis fold, URL codec, `isDirty`) in `src/lib/board-views.ts`; self-check `node src/lib/board-views.check.mts`. Live state is the URL (`v` = saved view id, `view g sg s f q p sc`; no state keys = the saved view's state), written with `history.replaceState`. Saved views: `.vibedoc/views.json` via `GET/POST /api/views` (SSE `views_updated`). Shell = `components/board/BoardTab.tsx`; views in `components/board/views/`. Keys on /board: `v` `1`–`4` `f` `n`, `/` focuses `#board-search`.
- Item actions (R054): roadmap `ItemActionsMenu` (⋯ in the sheet, right-click on map/timeline), task ⋯ in the panel and on cards, `DocActionsMenu` (doc header + right-click in the list; rename/move via `DocPathDialog`, `renameDoc` refuses to overwrite). Deletes don't confirm: `undoToast()` (`components/ui/toast.tsx`, `<Toaster/>` in the app layout) + restore endpoints (`/api/tasks/restore`, `/api/roadmap/restore`, docs re-POST); restores only plain `plans/tasks|roadmap/<file>.md`, never over an existing file. Task edit/delete/bulk: `/api/tasks/{update,delete,bulk}` (`updateTaskMeta` rewrites only the H1 + meta block; `setTaskEpic` moves the id between epics' **Tasks:**). Selection: table checkboxes, ⇧/⌘-click cards → `BulkBar`. Item keys ⇧E ⇧S ⇧D ⇧C ⌫ (`ITEM_KEYS` in shortcuts.ts, registry `components/shared/item-commands.ts` also feeds ⌘K). Known gap: deleting a task leaves `Depends on` pointing at it (dependents wait forever).
- Item properties (R055): `**Owner:** human | ai:<agent>` on tasks/epics (`src/lib/owner.ts`; an agent that starts a task takes it — MCP `agent` arg, else the client User-Agent; a human move only fills an empty owner). Docs: owner = last editor from `doc_updated` activity (autosaves coalesced 10 min, `noteDocEdit`). `paused` status (tasks + epics): never claimed, not a met dep, no at-risk / status nudge. Auto dates (`src/lib/auto-dates.ts`): Started/Done stamped, empty due = start + size days (`tasks.sizeDays` in settings), new task inherits its epic's due. Custom statuses (`src/lib/statuses.ts`, `statuses` in .vibedoc/settings.json): `Task.status` stays the built-in category, `customStatus` the id; files store the id; client store `components/shared/status-defs.ts`; Settings → Statuses. One panel header (`components/shared/ItemPanelHeader.tsx`) for task/epic/doc; inline edits via `InlineSelect`/`InlineDate` + `TaskFields.tsx`, optimistic (`updateTaskFields`) with rollback toast.
- Properties (Notion-style rows, `PropertyRows` in `components/shared/ItemPanelHeader.tsx`, used by the task/epic panels and `DocProperties`). Priority P0–P3 everywhere (`src/lib/doc-priority.ts`, pure; check `node src/lib/doc-priority.check.mts`; `PriorityField`/`PriorityBadge` in `components/shared/PriorityBadge.tsx`). Tasks/epics: `**Priority:**` meta line (`updateTaskMeta` / `updateRoadmapItem` patch `priority`). Docs: YAML frontmatter; flat `key: value` lines are properties (priority = picker, others text), list/map keys are kept untouched and refused for edits. `PUT /api/docs {path, properties: {key: value|null}}`, MCP `vibedoc_set_doc_priority`; `doc_updated {properties}` re-applies the rewrite to the open Yjs buffer. `MarkdownRenderer` strips frontmatter. The docs list has a priority badge + sort/filter (component state).
- Knowledge entries (R046): one fact per `memory/entries/E001-<slug>.md` (`# E001: summary` + `**Type:**` convention|gotcha|decision|preference + `**Updated:**`). Pure parse/format/index in `src/lib/entries.ts` (`ENTRY_TYPES`, `normalizeEntryId`, `formatEntryIndex`); `listEntries`/`getEntry`/`saveEntry`/`deleteEntry` in core.ts under `withEntryLock` (id allocation). MCP `vibedoc_save_entry` (no id = create, id = update; new summary renames the file) and `vibedoc_delete_entry` (hard delete, git keeps history). The index is appended in the `vibedoc_read_memory` MCP case only (`sessionStartMemory()` in core), not `readMemory()` / `GET /api/memory`; R048 caps it with `fitToBudget()` in `src/lib/recall.ts` at `memory.sessionBudgetTokens` (settings, default 2000). Activity reuses `memory_updated` ("Entry E001 saved"). Self-check: `node src/lib/entries.check.mts`.
- Safe memory updates (R045): `vibedoc_update_memory` / `POST /api/memory` rewrite only the sections passed (pure `mergeMemory()` in `src/lib/memory-sections.ts`, `SECTIONS` = field ↔ heading, don't rename; check `node src/lib/memory-sections.check.mts`); hand-written sections like this one survive. Every MEMORY.md write first snapshots it to `.vibedoc/memory-history/<stamp>-<actor>.md` (20 newest kept). `vibedoc_memory_history` lists / reads / restores; `/memory` History (N) shows a diff, Restore + Undo (`POST /api/memory/restore` returns `replacedId`). e2e: `e2e/memory-safe-updates.mjs`.
- Recall (R048): pure keyword recall in `src/lib/recall.ts` (`tokenize` with stopwords + plural strip, `rankEntries` summary+3 / id-type+2 / body+1, `fitToBudget`, `taskQuery`, `formatRelated`); self-check `node src/lib/recall.check.mts`. MCP `vibedoc_recall` (compact lines, no bodies) → `vibedoc_get_entries { ids }` (max 20). `vibedoc_next_task` / `vibedoc_get_task` end with `## Related memory` (≤3 hits with score ≥ 3, else nothing). No vector search by design.
- Memory browser (R047): `/memory` = `EntryList` (search via `filterEntries()` in `recall.ts`, type chips) + right pane `EntryDetail` (read / edit form, `?entry=E012` deep link) or the handoff. Routes `/api/memory/entries` (GET), `/save`, `/delete` (returns `{file, raw}`), `/restore` (`restoreEntry`: plain `memory/entries/E<n>-*.md` only, never over a taken id); Undo via `undoToast`. Entries carry `**By:** human | ai:<agent>` (`saveEntry(…, actor, agent)`, shown with `OwnerChip`). R053's T071/T072 render inside `EntryDetail` via `children`. e2e: `e2e/memory-browser.mjs`.
- Memory graph (R053): links are inferred from text, never stored. Pure `src/lib/memory-graph.ts` (`extractRefs`, `fileNode`, `buildGraph`, `neighbourhood`, `formatEntryLinks`, `graphLayout`; self-check `memory-graph.check.mts`); `getMemoryGraph()` in core globs the .md files per request (~15 ms on this repo). `GET /api/memory/graph[?entry=]`; `vibedoc_get_entries` adds `Links:` / `Linked from:`. UI: `EntryRelated` + `EntryHistory` inside `EntryDetail`, `MemoryGraph` (React Flow, `?view=graph`). History: `getFileHistory`/`getFileAtCommit` (execFile git); entry files match by id (`:(glob)memory/entries/E001-*.md`), not `--follow`, because renames of small files aren't detected.
- Doc link graph (R056): links are derived from text, never stored. Pure `src/lib/doc-links.ts` (`extractLinks`, `resolveLink`, `buildDocGraph`, `docLinks`, `formatRelatedFiles`; self-check `node src/lib/doc-links.check.mts`); `getDocGraph()` in core globs every `.md` and re-reads only files whose mtime changed. Links: relative `.md` (incl. `../`, then root-relative), backticked paths, task/epic/entry/ADR ids, `[[wikilinks]]` (exact path first, else basename: same folder first, then shortest path). `GET /api/docs/links?path=` · `/api/docs/graph`. UI: clickable links + muted broken ones in `MarkdownRenderer`, `LinkedDocs` panel, `LinkPreview` hover card, `/graph` (`components/graph/DocGraph.tsx`, deterministic `force-layout.ts`, check `node src/components/graph/force-layout.check.mts`; URL state `?node&focus&kinds&q`). `vibedoc_read_doc` ends with `## Related files`. Broken (md/wiki link to no file) and stale (backticked path to a missing file, `code[data-stale]`) are separate lists everywhere (graph menu, LinkedDocs, MCP footer). /graph: shape = kind, hue = task/epic status, accent = selection only; keyboard `/` Tab Enter(select, again opens) O arrows(nearest linked) Esc; edges not focusable. Motion: live SSE updates flash changed nodes (`graphChanges`) and never move the camera; relayout tweens dots + camera 420ms (jumps >150 nodes / reduced motion); one `/api/docs/graph` fetch per SSE burst (`fetchLinkJson` + `useLinkGeneration`). Second critique (T108–T112): labels show only while they render ≥ 9px (selection / matches / lit set keep chips), hit pads ≥ 24 screen px, fit floor 0.5; unlinked files sit on the "Unlinked N" shelf, not the map; search Enter frames matches then steps "2 of 15"; broken/stale skip placeholders, syntax examples, @includes, dot-folder files (toolbar shows broken only, stale is a /docs lint); done/cancelled draw hollow Pencil Grey, "Recent" (`touchedPaths`, 24h activity) = accent notch + `?recent=1`; selection = double ring (hue-independent); keys from `GRAPH_KEYS` (card kbd strip, `?` Graph section); Show in graph = `graphHref` → `?node=&focus=1`. Entrance = one `data-unfold` (a/b) on the wrapper set via the DOM; nodes/edges keep their inert unfold vars, so start/end never re-render (was a 115ms task); unveil + unfold run a task after the fit's label pass. Hover yields to keyboard focus; the selected card is a bottom sheet on phones. /docs empty state: "N files · M docs". Visual language + keyboard map: DESIGN.md "Doc Link Graph". e2e: `e2e/docs-links.mjs` (keyboard, SSE camera, shelf Tab, labels ≥ 9px at fit and zoomed out, hollow done, Recent, Show in graph, Tab preview).
- Activity log: only meaningful rows are written. Not logged: epic **Tasks:** side effects of task delete/restore/epic move/plan apply (`updateRoadmapItem(…, log=false)`), automatic registry rebuilds (`rebuildRegistry(…, log=false)`), a move to the status a task already has, and `session_start` while the actor's session is live (`currentSessionId`). Doc create/rename/delete take an `actor` (MCP passes `"ai"`). Pure `src/lib/activity.ts` reads an event (`eventCategory`, `eventAction`, `eventTarget`, `filterEvents`) from the existing title formats; titles must not change (touchedPaths, sessions, episodes parse them). Self-check `node src/lib/activity.check.mts`. /activity "All events" = the 2000-event log with kind + who filter chips, verb badges, and clickable titles (task panel, `/roadmap?item=`, `/memory?entry=`, `openDoc`).
- Pure libs never import values from each other (only `core.ts` does): `node *.check.mts` runs them without a bundler, so `./x` without `.ts` fails.
- Lint: 16 pre-existing `react-hooks` errors (React Compiler rules) outside roadmap files — don't add new ones.

## Handoff for next session
R046, R048, R047 and R053 (memory graph) are done, as a gh stack: `memory-entries` (#6) → `memory` (#7) → `memory-browser` (#9) → `memory-graph` (not pushed yet). Next memory epic: R045 safe memory updates (`/epic-breakdown`). R056 doc link graph is done on `feat/doc-link-graph` (T093–T112; second critique snapshot closed).
