# T067: Session-start token budget in vibedoc_read_memory
**Status:** ✅ Done
**Phase:** R048 — Token-cheap recall
**Size:** M
**Depends on:** T065
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
Session start stays small no matter how much memory there is. `vibedoc_read_memory` returns the handoff plus as much of the entry index as fits a token budget, then a pointer to `vibedoc_recall` for the rest.

## Context
- Epic: `plans/roadmap/R048-token-cheap-recall.md`. Epic done-when: with 200+ entries, session start stays inside the budget.
- R046 adds an entry index to what agents read at session start. This task puts a cap on it.
- Decided: the budget is a project setting in `.vibedoc/settings.json`: `memory.sessionBudgetTokens`, default **2000**. Tokens are estimated with `estimateTokens()` from t1 (chars / 4).
- Project rules: only `core.ts` touches fs, including reading settings.

## Scope
- [ ] `src/lib/recall.ts`: add pure `fitToBudget(handoff, hits, budget)`
- [ ] Add budget cases to `recall.check.mts`
- [ ] `core.ts`: read the setting (default 2000) and use `fitToBudget` to build the `read_memory` response
- [ ] `/api/mcp` `vibedoc_read_memory`: return the budgeted text

**Out of scope:** a settings UI for the budget (edit the JSON for now), ranking the index by the current task (t4 does that on claim).

## Files
- `src/lib/recall.ts`, `src/lib/recall.check.mts`
- `src/lib/core.ts`: where R046 builds the session-start index
- `src/app/api/mcp/route.ts`: `vibedoc_read_memory` case

## Implementation notes
```ts
export function fitToBudget(handoff: string, index: RecallHit[], budget: number):
  { text: string; shown: number; omitted: number; tokens: number }
```
- The handoff (MEMORY.md) always goes in whole and counts first.
- Index lines (`formatCompactLine`) are ordered newest first and added until the next one would go over the budget.
- If anything was left out, append `+N more entries — use vibedoc_recall { query }`. The footer counts toward the budget too.
- If the handoff alone is over the budget, show no index lines and add a one-line warning suggesting the handoff be trimmed. Don't cut the handoff.
- Keep the "session start" activity event that `read_memory` already emits.

## Acceptance criteria
- [ ] With 200+ entries, the `read_memory` output estimates ≤ the budget (unless the handoff alone is over it)
- [ ] With few entries, all of them are listed and there's no "+N more" footer
- [ ] Changing `memory.sessionBudgetTokens` changes how many index lines are shown
- [ ] A missing setting falls back to 2000
- [ ] Unit tests: everything fits, overflow with the footer counted, handoff over budget, 200-entry fixture under budget

## Verify
```bash
node src/lib/recall.check.mts
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_read_memory","arguments":{}}}' | wc -c   # ≈ ≤ 4 × budget
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] With a few entries, ask an agent to call vibedoc_read_memory → the handoff, then "## Knowledge entries (N)" listing every entry newest first as "E00N · type · summary (~N tok)", and no "+N more" line
- [ ] With 200+ entries in memory/entries, call vibedoc_read_memory → the reply is about 8,000 characters or less (2000 tokens) and ends with "+N more entries — use vibedoc_recall { query }"
- [ ] Add {"memory":{"sessionBudgetTokens":500}} to .vibedoc/settings.json and call it again → far fewer entry lines are shown and the "+N more" count goes up
- [ ] Make memory/MEMORY.md longer than the budget → the whole handoff is still there, no entry lines are shown, and a warning says to trim MEMORY.md
### Regression risk
- [ ] Each vibedoc_read_memory call still shows "Session started" in /activity, and task custom statuses / automatic due dates (same settings file) still work
