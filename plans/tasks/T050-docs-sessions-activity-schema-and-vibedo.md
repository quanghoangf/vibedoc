# T050: Docs — sessions, activity schema and vibedoc_get_sessions
**Status:** ✅ Done
**Phase:** R041 — Agent session timeline
**Size:** S
**Depends on:** T048, T049

## Goal
The docs describe sessions accurately: how they are formed, where the UI shows them, and how agents read them.

## Context
- Epic: `plans/roadmap/R041-agent-session-timeline.md`
- Follow how T045 documented the planning tools.

## Scope
- [ ] In `docs/architecture/04-data/DATA.md`, add `sessionId` to the activity schema, change the cap to 2000, and describe the session rules (sessionId, 30-min gap fallback, `session_start`)
- [ ] In `docs/architecture/03-services/core-lib/OVERVIEW.md`, add a Sessions group (`groupSessions`, `sessionsForTask`)
- [ ] Document `vibedoc_get_sessions` in the MCP tools doc (`docs/**/mcp-tools.md`) and in the README tool list
- [ ] In the README Activity section, describe the Sessions timeline and the task → sessions jump
- [ ] Update the README line that says the activity log keeps 500 events, if present

## Files
- `docs/architecture/04-data/DATA.md`
- `docs/architecture/03-services/core-lib/OVERVIEW.md`
- MCP tools doc and `README.md`

## Acceptance criteria
- [ ] No doc still says 500 events. `vibedoc_search_docs "500"` finds nothing stale
- [ ] The tool's docs match its real params and output
- [ ] Every edited doc renders cleanly in the docs viewer

## Verify
```bash
pnpm build
# grep -rn "500" docs README.md | grep -i activity   → nothing stale
```
