# T113: Episode builder + write an episode when a chat turn ends without a handoff
**Status:** ✅ Done
**Phase:** R050 — Automatic session episodes
**Size:** M
**Depends on:** —
**Done:** 2026-10-03

## Goal
When an agent chat turn finishes and its session never called `vibedoc_update_memory`, VibeDoc writes `.vibedoc/episodes/<sessionId>.md`: a readable summary + handoff built from the session's activity and the chat's last assistant message. This is the thin end-to-end path of the epic.

## Context
- Epic: `plans/roadmap/R050-automatic-session-episodes.md`
- Decided: summaries are **deterministic** (no extra LLM call), built from `groupSessions()` output (`src/lib/sessions.ts`, T046) plus the chat transcript.
- Decided: episodes are their own files in `.vibedoc/episodes/`, never written into `MEMORY.md` (R045 safe memory updates is still planned; never clobber a human/agent handoff).
- Decided for this epic: only the auto handoff ships. Missing-handoff flags in the UI, richer timeline summaries and knowledge-entry suggestions are out of scope (leave for a follow-up).
- CLAUDE.md: only `src/lib/core.ts` touches fs; `emitUpdate()` only from API routes; pure logic in its own `src/lib/*.ts` with a `*.check.mts` self-check (see `src/lib/sessions.ts`, `src/lib/entries.ts`).

## Scope
- [ ] `src/lib/episodes.ts` (new, pure): `buildEpisode(session, opts)` → markdown, `parseEpisode(raw, file)`, `isHandoffWritten(session, events)`
- [ ] `src/lib/episodes.check.mts` (new): assert-based self-check, prints `episodes: ok`
- [ ] `core.ts`: `writeEpisode(ep, root)`, `listEpisodes(root)` (newest `end` first; missing folder → `[]`), `getLatestEpisode(root)` under a `// ─── Episodes ───` section
- [ ] `src/app/api/chat/route.ts`: after the `claude -p` process exits, find the session(s) whose events fall inside the turn's time window; for each one with no handoff, build and write the episode (source `chat <conversationId>`), then `emitUpdate()`
- [ ] Add `.vibedoc/episodes/*.md` to the list of files VibeDoc writes in `CLAUDE.md` (Key architecture rules)

**Out of scope:** read_memory using episodes (t2), epic-run end and sessions outside the chat (t3), docs (t4).

## Files
- `src/lib/episodes.ts`, `src/lib/episodes.check.mts`: new
- `src/lib/core.ts`: episode functions + `EPISODES_DIR = '.vibedoc/episodes'`
- `src/app/api/chat/route.ts`: hook after the turn ends
- `CLAUDE.md`: one-line addition

## Implementation notes
Pin this shape; t2/t3 build on it:
```ts
export type Episode = { sessionId: string; actor: string; start: string; end: string; source: string; headline: string; body: string; file: string }
export function buildEpisode(s: Session, opts: { source: string; lastMessage?: string; openTasks?: { id: string; title: string; status: string }[] }): string
export function parseEpisode(raw: string, file: string): Episode | null
export function isHandoffWritten(s: Session, events: ActivityEvent[]): boolean
```
File format (meta block without blank lines, like task files):
```md
# Episode ses_…: 3 tasks moved (2 done) · 1 doc changed
**Session:** ses_…
**Actor:** ai:claude-code
**Start:** 2026-10-03T09:12:00Z
**End:** 2026-10-03T10:40:00Z
**Source:** chat c_abc123

## What happened
- T046 → done
- Docs changed: docs/x.md
- Decisions: ADR-012 …

## Where it stopped
> <last assistant message, trimmed>

## Open
- T047 (in-progress)
```
- **Gotcha:** knowledge-entry saves reuse the `memory_updated` event type (title `Entry E001 saved`, T086), so `Session.memoryUpdated` can be true without a handoff. `isHandoffWritten` must only count `memory_updated` events that are MEMORY.md writes (not titles starting with `Entry `). Check the real titles in `core.ts` before matching.
- Cap the episode body at ~1600 chars (≈400 tokens): trim the last message first, then list tails (`+N more`). It is read at session start (t2).
- Writing is idempotent: the same session overwrites its own file on every later turn.
- A session with zero events (pure Q&A turn) writes nothing.
- The last assistant message comes from the saved conversation (`.vibedoc/chats/<id>.json`); read it via the existing conversations helper in core.
- `openTasks`: tasks from the session whose last status is not done/cancelled.
- The episode headline says `entries saved` where `groupSessions()` says `memory updated`: an episode only exists without a handoff, so that part can only be entry saves.
- **Known ceiling:** sessions are per root+actor (`stampSession`), so chats in one 30-min window share a session and its episode. `**Source:**` lists every chat that wrote into it (`mergeSources`), "Where it stopped" is the last turn's reply, and an external `ai` MCP agent in the same window still folds in under `ai:claude-code`. Upgrade path: stamp chat MCP calls with their own session id.

## Acceptance criteria
- [ ] A chat turn that moves a task and never calls `vibedoc_update_memory` leaves `.vibedoc/episodes/<sessionId>.md` in the format above
- [ ] A turn whose session called `vibedoc_update_memory` writes no episode; a session that only saved an entry still gets one
- [ ] A second turn in the same session rewrites the same file, not a new one
- [ ] Episode body stays ≤ ~1600 chars with long transcripts
- [ ] `episodes.check.mts` covers build → parse round trip, handoff detection incl. the entry-save case, the size cap, and empty sessions

## Verify
```bash
node src/lib/episodes.check.mts
pnpm build && pnpm lint
# pnpm dev → in the chat sidebar ask the agent to move a task to in-progress (no memory update)
ls .vibedoc/episodes && cat .vibedoc/episodes/*.md
```

## Manual tests
_2026-10-03 — ai_
### Steps
- [ ] Open a chat (Agent button), ask it to move a todo task to in-progress and not update memory → the card moves; `.vibedoc/episodes/ses_*.md` appears with `**Source:** chat c-…`
- [ ] Open that episode file → H1 headline, Session/Actor/Start/End/Source meta, "What happened" lists the task, "Where it stopped" quotes the agent's last reply, "Open" lists the task
- [ ] In the same chat, ask it to move the task to done → the same file is rewritten (no second file), headline says "(1 done)", no Open section
- [ ] Ask it to save a knowledge entry and move a task (no memory update) → an episode is still written
- [ ] Ask it to call vibedoc_update_memory in a turn → no episode file changes for that session
- [ ] Ask a pure question (no tool writes) in a fresh session → no new episode file
### Regression risk
- [ ] Chat streaming, Stop, and resume still work (route now also parses stdout lines)
- [ ] Saved chats in `.vibedoc/chats/` still load after reload
