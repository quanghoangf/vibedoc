# T046: Session model — sessionId stamping, cap 2000, groupSessions() + /api/sessions
**Status:** ✅ Done
**Phase:** R041 — Agent session timeline
**Size:** M
**Depends on:** —

## Goal
Every activity event belongs to a session, and `GET /api/sessions` returns sessions grouped and summarized. Every later task in R041 builds on this.

## Context
- Epic: `plans/roadmap/R041-agent-session-timeline.md`
- Decision: sessions come from a `sessionId` stamped on new events. Older events that have no `sessionId` fall back to grouping by idle gap: a new session starts when the same `actor` has a gap of more than 30 min, or at a `session_start` event.
- Decision: raise the activity cap from 500 to 2000 so that a day away fits in the log.
- Sessions are derived when read and never stored in a separate file. The grouping logic lives in a pure module (no fs) so that both the API and `/api/mcp` can import it. This follows `src/lib/roadmap-health.ts`.
- CLAUDE.md: only `src/lib/core.ts` touches fs. Call `emitUpdate()` only from API routes.

## Scope
- [ ] Add optional `sessionId?: string` to `ActivityEvent` in `src/lib/core.ts`
- [ ] In `appendActivity()`, stamp `sessionId`. Keep the current session per actor in memory (module-level map `{ id, lastAt }`). Start a new id (`ses_<timestamp>_<rand>`) on `session_start`, when the actor has no current session, or when `now - lastAt > 30 min`
- [ ] Raise the activity cap 500 → 2000 (constant)
- [ ] New pure module `src/lib/sessions.ts` with `groupSessions(events: ActivityEvent[], opts?: { gapMs?: number }): Session[]`
- [ ] `Session` shape: `{ id, actor, start, end, eventCount, tasks: {id, lastStatus}[], docs: string[], decisions: string[], memoryUpdated: boolean, headline: string }`. `headline` is for example `3 tasks moved (2 done) · 2 docs changed · 1 ADR`. Sort sessions newest first
- [ ] Add a `sessionsForTask(sessions, taskId)` helper
- [ ] Add `src/lib/sessions.check.mts` with asserts. Print `sessions: ok`
- [ ] Add `src/app/api/sessions/route.ts` for `GET`, with optional `?taskId=` and `?limit=`. It reads through `readActivity(root, 2000)` and calls `groupSessions`

**Out of scope:** UI (T047), task-detail jump (T048), MCP tool (T049), docs (T050).

## Files
- `src/lib/core.ts`: `ActivityEvent.sessionId`, stamping in `appendActivity()`, the cap
- `src/lib/sessions.ts`: new; `Session`, `groupSessions`, `sessionsForTask`
- `src/lib/sessions.check.mts`: new
- `src/app/api/sessions/route.ts`: new
- `src/types/index.ts`: re-export `Session`

## Implementation notes
- Events are stored newest-first (prepend). Reverse them before grouping.
- Docs changed: gather them from event types that carry a path (`doc_created`, `doc_deleted`, and any doc-write types present in the union). Skip `doc_read`, because a read is not a change. Read the current `ActivityEvent.type` union and map each type explicitly.
- Decisions come from `decision_logged` titles.
- The in-memory map resets when the dev server restarts. Stamping a new session after a restart is acceptable.

## Acceptance criteria
- [ ] New events in `.vibedoc-activity.json` carry `sessionId`. Events from the same actor that are less than 30 min apart share an id
- [ ] Legacy events without `sessionId` are grouped by a 30-min actor gap and by `session_start`
- [ ] The log keeps up to 2000 events
- [ ] `GET /api/sessions` returns sessions newest-first, with headline and linked tasks and docs. `?taskId=T003` returns only the sessions that touched T003
- [ ] `node src/lib/sessions.check.mts` prints `sessions: ok`. It covers gap splits, `session_start` splits, mixed legacy and stamped events, and headline counts

## Verify
```bash
node src/lib/sessions.check.mts
pnpm build && pnpm lint
# pnpm dev, move two tasks via the board, then:
curl -s localhost:3000/api/sessions | jq '.[0]'
curl -s 'localhost:3000/api/sessions?taskId=T001' | jq length
```
