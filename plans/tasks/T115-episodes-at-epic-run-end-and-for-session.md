# T115: Episodes at epic-run end and for sessions that ended outside the chat
**Status:** ✅ Done
**Phase:** R050 — Automatic session episodes
**Size:** M
**Depends on:** T114
**Done:** 2026-10-03

## Goal
An epic run (`/work-epic` loop) and an external agent session (e.g. Claude Code in a terminal over `/api/mcp`) also leave an episode when they end without a handoff, so the guarantee doesn't depend on the chat sidebar.

## Context
- Epic: `plans/roadmap/R050-automatic-session-episodes.md` ("a handoff written when a chat or epic run ends").
- Builder and writer from t1; read_memory surfacing from t2.
- Sessions end implicitly (30-min actor gap or a new `session_start`, see T046), so there is no reliable "end" event for external agents.
- Decided: two triggers. (1) `vibedoc_next_task` returns nothing ready for an epic → the caller's run is over; write its episode now (source `epic R0xx`). (2) Lazy backfill: when `vibedoc_read_memory` is called, any ended session (not the caller's current one) that has no handoff and no episode file gets one written first (source `inferred`).
- Out of scope: recording raw tool calls from outside VibeDoc (epic out-of-scope).

## Scope
- [x] `core.ts`: `backfillEpisodes(root, { excludeSessionId, limit })` — writes episodes for the most recent ended sessions without a handoff or episode (limit 5, newest first)
- [x] `/api/mcp` `vibedoc_read_memory`: call backfill before building the response (t2 then picks them up)
- [x] `/api/mcp` `vibedoc_next_task`: when the result is "nothing ready", write the episode for the caller's current session if it has no handoff; append one line to the reply: `Episode saved → .vibedoc/episodes/<id>.md`
- [x] `emitUpdate()` after any episode write in these routes
- [x] Self-check cases for picking which sessions to backfill (pure selector in `episodes.ts`)

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
- [x] Running `vibedoc_next_task` on an epic with nothing left writes an episode for that run (when no handoff was written)
- [x] A terminal agent session that moved tasks, then went idle > 30 min, gets an `inferred` episode on the next `vibedoc_read_memory`, and that call shows it
- [x] Sessions with a handoff or an existing episode are never rewritten by backfill
- [x] The caller's still-running session is never backfilled
- [x] Self-check covers ended/not-ended, handoff present, existing episode, and the limit

## Verify
```bash
node src/lib/episodes.check.mts
pnpm build && pnpm lint
# Move a task via MCP as actor A, wait/fake a >30 min gap (edit timestamps in .vibedoc-activity.json), then:
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_read_memory","arguments":{}}}' | jq -r '.result.content[0].text' | grep -A5 'Since the last handoff'
ls .vibedoc/episodes
```

## Notes
- Backfill only looks at sessions that ended after the last MEMORY.md write: older ones are covered by that handoff and T114 never shows them, and without the cutoff every `vibedoc_read_memory` would write 5 more episodes for old history.
- Backfill only picks `ai` sessions with a non-read event (`hasWork`); human board sessions and read-only sessions get none.
- Both "finished" and "waiting" replies of `vibedoc_next_task` count as the end of the run.
- Ceiling: `vibedoc_read_memory` starts a new session (T046), so an agent that calls it twice in one run gets an `inferred` episode for the first half. It ends before that run's handoff, so it is not shown.

## Manual tests
_2026-10-03 — ai_
### Steps
- [ ] From a terminal agent, run `vibedoc_next_task` on an epic until it says finished (no `vibedoc_update_memory`) → the reply ends with `Episode saved → .vibedoc/episodes/<id>.md`, and the file has `**Source:** epic R0xx`
- [ ] Do the same, but call `vibedoc_update_memory` before the last `vibedoc_next_task` → no "Episode saved" line and no new file
- [ ] As a terminal agent, move a task, then wait more than 30 min (or shift the timestamps in `.vibedoc-activity.json` back) and call `vibedoc_read_memory` → a new episode with `**Source:** inferred` exists and the reply shows it under `## Since the last handoff`
- [ ] Call `vibedoc_read_memory` again → the episode file is not rewritten (same mtime) and no new episode appears
- [ ] Right after moving a task, call `vibedoc_read_memory` from another client within 30 min → episodes are written only for sessions that already ended, never the running one
### Regression risk
- [ ] A chat turn that ends without a handoff still writes its episode with the chat's last reply in "Where it stopped"
- [ ] `vibedoc_next_task` still claims and returns the next ready task as before when one is ready
