# T140: MCP tool vibedoc_get_frontend and status line
**Status:** ✅ Done
**Phase:** R057 — Frontend app detection
**Size:** S
**Depends on:** T139
**Owner:** ai:claude-code
**Due:** 2026-10-05
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
Agents (R058 spec writers) can ask VibeDoc for the frontend app, its URL and auth state, and `vibedoc_get_status` mentions it in one line.

## Context
- Epic: `plans/roadmap/R057-frontend-app-detection.md`
- CLAUDE.md: `/api/mcp` is hand-rolled JSON-RPC. Add the tool the way the existing tools are registered in `src/app/api/mcp/route.ts`.

## Scope
- [ ] `vibedoc_get_frontend` (no params) returns the detected/overridden app as readable text: dir, framework, start command, URL, source, Playwright status and auth state once those exist (show "unknown" until T4/T6 add them)
- [ ] No frontend → a clear message plus a pointer to the Settings override
- [ ] `vibedoc_get_status`: one line, e.g. `Frontend: apps/web (vite) · pnpm --filter web dev · http://localhost:5173`
- [ ] Add the tool to `docs/architecture/mcp-tools.md` and `docs/architecture/03-services/mcp-server/TOOLS.md`

**Out of scope:** tools that start the app or run tests (T5/T7 expose these through the UI/API; MCP actions are for later epics).

## Files
- `src/app/api/mcp/route.ts`: register the tool and add the status line
- the two MCP docs above

## Acceptance criteria
- [ ] `tools/list` includes `vibedoc_get_frontend`
- [ ] Calling it on the monorepo fixture returns `apps/web` and the right URL
- [ ] `vibedoc_get_status` shows the Frontend line, or `Frontend: none detected`

## Verify
```bash
npm run lint && npm run build
curl -s localhost:3000/api/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_frontend","arguments":{}}}'
```

## Manual tests
_2026-10-04 — ai_
### Verified
- [x] npm run lint: 17 problems (14 errors, 3 warnings), same as baseline; eslint on the changed files: 0 problems
- [x] npm run build passes; dev server on :3000 still answers
- [x] node src/lib/frontend.check.mts prints ok
- [x] tools/list includes vibedoc_get_frontend
- [x] vibedoc_get_frontend on this repo: . (vibedoc), next, pnpm run dev, http://localhost:3000, plus the own-repo and port-3000 warnings
- [x] vibedoc_get_frontend with ?root=src/lib/frontend-fixtures/pnpm-monorepo: apps/web (web), pnpm --filter web dev, http://localhost:3100, Other apps listed
- [x] vibedoc_get_frontend with ?root=src/lib/frontend-fixtures/docs-only: "No web frontend detected" + pointer to Settings → Frontend app
- [x] vibedoc_get_status on the monorepo fixture: Frontend: apps/web (next) · pnpm --filter web dev · http://localhost:3100
### Steps
- [ ] On /settings → Frontend app, save a URL override (e.g. http://localhost:9999). vibedoc_get_frontend shows **URL:** http://localhost:9999 and **Source:** override (Settings → Frontend app); vibedoc_get_status shows the new URL. Reset the override afterwards.
- [ ] On /settings, pick apps/docs for the pnpm-monorepo fixture. vibedoc_get_frontend shows apps/docs (astro) with pnpm --filter docs dev and lists apps/web under Other apps.
- [ ] Run VibeDoc with VIBEDOC_DEMO=1 on another port. tools/list includes vibedoc_get_frontend and calling it works (read-only).
### Regression risk
- [ ] vibedoc_get_status on a normal project still shows Docs, Memory, Board counts and Active/Blocked lists; the Frontend line sits between Memory and Board.
- [ ] vibedoc_get_status does not fail when .vibedoc/settings.json has a malformed frontend key; the line falls back to the detected app or "none detected".
