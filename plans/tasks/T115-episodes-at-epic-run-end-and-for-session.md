# T115: Episodes at epic-run end and for sessions that ended outside the chat
**Status:** 📋 Ready
**Phase:** R050 — Automatic session episodes
**Size:** M
**Depends on:** T114

## Goal
An epic run (`/work-epic` loop) and an external agent session (e.g. Claude Code in a terminal over `/api/mcp`) also leave an episode when they end without a handoff, so the guarantee doesn't depend on the chat sidebar.

## Context
- Epic: `plans/roadmap/R050-automatic-session-episodes.md` ("a handoff written when a chat or epic run ends").
- Builder and writer from t1; read_memory surfacing from t2.
- Sessions end implicitly (30-min actor gap or a new `session_start`, see T046), so there is no reliable "end" event for external agents.
- Decided: two triggers. (1) `vibedoc_next_task` returns nothing ready for an epic → the caller's run is over; write its episode now (source `epic R0xx`). (2) Lazy backfill: when `vibedoc_read_memory` is called, any ended session (not the caller's current one) that has no handoff and no episode file gets one written first (source `inferred`).
- Out of scope: recording raw tool calls from outside VibeDoc (epic out-of-scope).

## Scope
- [ ] `core.ts`: `backfillEpisodes(root, { excludeSessionId, limit })` — writes episodes for the most recent ended sessions without a handoff or episode (limit 5, newest first)
- [ ] `/api/mcp` `vibedoc_read_memory`: call backfill before building the response (t2 then picks them up)
- [ ] `/api/mcp` `vibedoc_next_task`: when the result is "nothing ready", write the episode for the caller's current session if it has no handoff; append one line to the reply: `Episode saved → .vibedoc/episodes/<id>.md`
- [ ] `emitUpdate()` after any episode write in these routes
- [ ] Self-check cases for picking which sessions to backfill (pure selector in `episodes.ts`)

**Out of scope:** docs (t4); UI flags for missing handoffs.

## Files
- `src/lib/episodes.ts`, `src/lib/episodes.check.mts`: add `sessionsNeedingEpisode(sessions, events, existingIds, currentSessionId)`
- `src/lib/core.ts`: `backfillEpisodes`
- `src/app/api/mcp/route.ts`: `vibedoc_read_memory` and `vibedoc_next_task` cases

## Implementation notes
- A session counts as ended if its `end` is more than 30 min ago or a later session exists for the same actor (reuse the gap constant from `sessions.ts`, don't duplicate it).
- The current caller's session id: the actor's in-memory current session from `appendActivity()` stamping (T046). Expose a small getter in core if none exists.
- No transcript for external sessions: `lastMessage` is omitted; the "Where it stopped" section falls back to the last event title.
- Backfill must be cheap: it reads activity once (already read for sessions) and only lists the episodes dir.

## Acceptance criteria
- [ ] Running `vibedoc_next_task` on an epic with nothing left writes an episode for that run (when no handoff was written)
- [ ] A terminal agent session that moved tasks, then went idle > 30 min, gets an `inferred` episode on the next `vibedoc_read_memory`, and that call shows it
- [ ] Sessions with a handoff or an existing episode are never rewritten by backfill
- [ ] The caller's still-running session is never backfilled
- [ ] Self-check covers ended/not-ended, handoff present, existing episode, and the limit

## Verify
```bash
node src/lib/episodes.check.mts
pnpm build && pnpm lint
# Move a task via MCP as actor A, wait/fake a >30 min gap (edit timestamps in .vibedoc-activity.json), then:
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_read_memory","arguments":{}}}' | jq -r '.result.content[0].text' | grep -A5 'Since the last handoff'
ls .vibedoc/episodes
```
