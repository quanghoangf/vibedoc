# T114: Next session starts from the latest episode (vibedoc_read_memory)
**Status:** 📋 Ready
**Phase:** R050 — Automatic session episodes
**Size:** M
**Depends on:** T113

## Goal
When the newest episode is newer than `MEMORY.md`, `vibedoc_read_memory` shows it right after the handoff, so the next session starts from where the last one actually stopped. This closes the epic's Done when.

## Context
- Epic: `plans/roadmap/R050-automatic-session-episodes.md`. Done when: a chat that ends without calling the memory tool still leaves a readable session summary, and the next session starts from it.
- Episodes come from t1 (`getLatestEpisode(root)`, `.vibedoc/episodes/`).
- `read_memory` output is budgeted by `fitToBudget()` in `src/lib/recall.ts` (T067, `memory.sessionBudgetTokens`, default 2000). The handoff always goes in whole.
- CLAUDE.md: only `core.ts` touches fs.

## Scope
- [ ] `core.ts`: helper returning the episode(s) to show: episodes whose `end` is later than `MEMORY.md`'s mtime, newest first, max 1 shown in full
- [ ] Extend `fitToBudget` (or wrap it) so the episode section counts toward the budget after the handoff and before the entry index
- [ ] `/api/mcp` `vibedoc_read_memory`: insert `## Since the last handoff (auto, <end date>)` with the episode body, plus `+N older episodes in .vibedoc/episodes/` when more than one is newer
- [ ] Budget cases in `recall.check.mts`

**Out of scope:** UI for episodes; episodes for sessions outside the chat (t3).

## Files
- `src/lib/recall.ts`, `src/lib/recall.check.mts`
- `src/lib/core.ts`: where the read_memory response is built
- `src/app/api/mcp/route.ts`: `vibedoc_read_memory` case

## Implementation notes
- Compare against `MEMORY.md` mtime (via core, `fs.stat`), not activity events: a person editing MEMORY.md by hand also counts as a fresh handoff.
- Order: handoff → episode section → entry index → `+N more entries` footer. If handoff + episode exceed the budget, keep both whole, drop index lines, keep the existing over-budget warning.
- Keep the "session start" activity event `read_memory` already emits.

## Acceptance criteria
- [ ] After a chat that left an episode (t1), a new chat calling `vibedoc_read_memory` sees the `Since the last handoff` section with that episode
- [ ] After `vibedoc_update_memory` runs, the section disappears (MEMORY.md is newer)
- [ ] With no episodes, output is identical to today
- [ ] The total still respects `memory.sessionBudgetTokens` (handoff/episode never cut)
- [ ] Unit tests: episode fits, episode pushes index lines out, no episode

## Verify
```bash
node src/lib/recall.check.mts
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_read_memory","arguments":{}}}' | jq -r '.result.content[0].text' | head -40
```
