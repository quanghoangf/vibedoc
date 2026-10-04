# T132: Demo mode: VIBEDOC_DEMO=1 makes the app read-only
**Status:** ✅ Done
**Phase:** R042 — Demo & docs site
**Size:** L
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-11
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
With `VIBEDOC_DEMO=1`, VibeDoc runs read-only. Visitors can browse the board, roadmap, docs, graph and memory, but nothing can be written, no agent can be spawned, and MCP write tools are refused. This is the risky core of R042, so it goes first.

## Context
- Epic: `plans/roadmap/R042-demo-and-docs-site.md`
- Decided: the demo is the **real hosted app** in read-only mode, not a static snapshot.
- Rule (CLAUDE.md): "`src/lib/core.ts` is the only place that touches the file system." The demo flag helper must not import `fs`.
- Rule: "Never use `localStorage`." The UI learns about demo mode from the server (an API field), not from client storage.

## Scope
- [ ] `src/lib/demo.ts`: `isDemo()` reads `process.env.VIBEDOC_DEMO === '1'`; `demoForbidden()` returns a 403 `NextResponse` with `{ error: 'Read-only demo' }`
- [ ] Guard every mutating handler (POST/PUT/PATCH/DELETE) in `src/app/api/**`: tasks, docs, memory, decisions, roadmap/*, conversations, tasks/manual-tests, tasks/review, plan apply, and any other route that writes
- [ ] `/api/chat` returns 403 in demo mode and never spawns `claude -p`
- [ ] `/api/mcp`: in demo mode only read tools run (read/list/get/search/recall). Any other tool returns a JSON-RPC error "read-only demo"
- [ ] `core.ts` skips side-effect writes in demo mode (activity log entries, recall log, auto meta lines), so a read-only host filesystem never throws
- [ ] Expose `demo: true` to the UI (e.g. on `/api/summary` or a small `/api/config`)
- [ ] UI in demo mode: a slim "Live demo, read-only. Install: `npx vibedoc`" banner in the app header; hide or disable create/edit/delete, drag-and-drop on the board, editors, chat sidebar and the chat page

**Out of scope:** the example project and deploy (T2), the landing page and docs (T3).

## Files
- `src/lib/demo.ts`: new
- `src/app/api/**/route.ts`: add the guard at the top of mutating handlers
- `src/app/api/mcp/route.ts`: allowlist of read-only tools in demo mode
- `src/lib/core.ts`: skip incidental writes when `isDemo()`
- `src/app/page.tsx`, roadmap/graph/chat pages, `ChatContext.tsx`: read the demo flag and hide write UI

## Implementation notes
- Prefer one allowlist of read-only MCP tool names over a denylist, so new write tools are blocked by default.
- Drag-and-drop on the board calls the tasks API. With the API guarded, the UI must also stop the drag, so cards don't snap back after a 403.
- The UI is a client component; fetch the flag once at load along with the existing summary fetch.

## Acceptance criteria
- [ ] `VIBEDOC_DEMO=1 npm run dev`: board, roadmap, docs, graph and memory pages render with data
- [ ] Any POST/PUT/PATCH/DELETE to a mutating API route returns 403; no file in the project changes (`git status` clean after clicking around)
- [ ] `/api/chat` returns 403 and starts no process
- [ ] MCP `vibedoc_update_task` returns an error; `vibedoc_list_tasks` works
- [ ] Banner is visible, and no create/edit/delete/chat control is reachable
- [ ] Without the flag, the app behaves exactly as before

## Verify
```bash
npm run lint && npm run build
VIBEDOC_DEMO=1 npm run dev
curl -s -X POST localhost:3000/api/tasks -d '{}' -o /dev/null -w '%{http_code}\n'   # 403
git status   # clean after browsing
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] With `VIBEDOC_DEMO=1`, narrow the window below `lg`: the header banner reads "Read-only demo" (full text with `npx vibedoc` at lg and wider) and the page title in the header is not clipped or pushed off.
- [ ] Board → Table view: status, owner, due, size and priority cells are plain text (clicking opens nothing), the select-checkbox column is empty, and ⇧/⌘-click on a board card opens the task instead of selecting it (no BulkBar).
- [ ] Roadmap map: nodes cannot be dragged; right-clicking a node shows the browser menu, not the item menu; the "N need attention" list has no "→ status" buttons; the epic sheet footer shows only "Open file", and task rows have no chat icon.
- [ ] Docs: open a doc; there are no Preview/Split/Edit tabs, no Saved status and no "Break down with agent" button; property names are not menus and there is no "Add a property"; an empty doc says "This doc is empty." with no "Start writing".
- [ ] Memory: open `/memory?entry=<id>`; there is no Edit or Delete and ⌫ does nothing. History shows the version diff with no "Restore this version". There is no Cleanup button, and `?cleanup=1` does not open the panel.
- [ ] ⌘K palette with a task panel open: no "New chat" / "New doc" and no item actions; ⇧E, ⇧S, ⇧D, ⇧C, ⌫, `n` and `c` do nothing. "Toggle light / dark theme" still flips locally (its save gets a silent 403, left on purpose as a viewer preference).
- [ ] With `VIBEDOC_DEMO=1`, `GET /api/docs?root=/etc` and MCP `/api/mcp?root=/etc` still return the configured project (the `?root=` override is ignored via `rootFrom()`), and the project switcher / `/api/projects` lists only the configured project.
### Regression risk
- [ ] Without the flag: drag a card between columns, edit a doc (autosave), open a chat with `c`, edit an inline status/due, tick a manual test, and save a board view; all behave as before and write files.
- [ ] Without the flag: the project switcher still lists sibling projects, and switching to one (`?root=`) loads its board.
- [ ] The `demo` flag reaches the UI through `/api/summary`. If that fetch fails, write controls render, but every write still returns 403 and the optimistic UI rolls back with a toast.
