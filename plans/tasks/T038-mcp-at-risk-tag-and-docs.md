# T038: At-risk tag in vibedoc_get_roadmap + docs
**Status:** 📋 Todo
**Phase:** R038 — Epic & horizon progress
**Size:** S (~1 hr)
**Depends on:** T035, T036

## Goal
An agent reading `vibedoc_get_roadmap` sees which epics are at risk right on each epic's line, and the docs explain the at-risk rules and the task-weighted horizon progress. That way agents and humans read the same signal.

## Context
- Epic: `plans/roadmap/R038-epic-and-horizon-progress.md`
- After T035, at-risk entries already appear under "### ⚠️ Needs attention". This task adds the inline tag to each item line in `fmt()` (`src/app/api/mcp/route.ts`, `vibedoc_get_roadmap` case, ~line 706).
- Tool docs live in `docs/architecture/mcp-tools.md`.

## Scope
- [ ] In `fmt()`, append ` ⚠ at risk` to the line of any item that has an `'at-risk'` drift entry (build a `Set` of ids from `drift` once, outside `fmt`)
- [ ] Document the following in `docs/architecture/mcp-tools.md` under `vibedoc_get_roadmap`: the three at-risk rules (overdue task, blocked task, due ≤7 days with nothing started), the `⚠ at risk` tag, and that horizon `[N/M done]` now counts tasks (T036)
- [ ] Add one line to the Roadmap conventions in `memory/MEMORY.md`: at-risk is a derived drift kind in `roadmap-health.ts`

**Out of scope:** a separate `vibedoc_get_risks` tool, and changing `roadmapHint`.

## Files
- `src/app/api/mcp/route.ts`: the `vibedoc_get_roadmap` case only
- `docs/architecture/mcp-tools.md`
- `memory/MEMORY.md`

## Acceptance criteria
- [ ] `vibedoc_get_roadmap` on the T035 fixture prints `⚠ at risk` on exactly the three at-risk epics' lines
- [ ] Epics that aren't at risk print exactly as before
- [ ] The docs describe the rules as they are implemented in `roadmap-health.ts` (the thresholds match `SOON_DAYS`)

## Verify
```bash
pnpm build && pnpm lint
# pnpm dev, then:
curl -s -X POST 'http://localhost:3000/api/mcp?root=<fixture>' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_roadmap","arguments":{}}}'
# → the three fixture epics end with "⚠ at risk"
```
