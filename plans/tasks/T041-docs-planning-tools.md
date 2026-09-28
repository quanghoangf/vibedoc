# T041: Docs — planning tools and chat planning
**Status:** ✅ Done
**Phase:** R040 — Planning from the chat sidebar
**Size:** S (~1 hr)
**Depends on:** T040

## Goal
Users find out that they can plan from the UI, and agents or MCP clients know the three new tools and their contracts.

## Context
- Epic: `plans/roadmap/R040-planning-from-the-chat-sidebar.md`
- New tools: `vibedoc_propose_plan` (T035, T039), `vibedoc_ask_questions` (T037), `vibedoc_get_planning_guide` (T038). New route: `POST /api/plan/apply` (T035).
- `docs/architecture/mcp-tools.md` has one `###` section per tool. `README.md` states the tool count in two places and has a tool table. The table was already missing `vibedoc_propose_edit` before this epic, per the R037 review.
- Copy the contracts from the code (`src/lib/plan.ts`, `src/app/api/mcp/route.ts`), not from these task files.

## Scope
- [ ] `mcp-tools.md`: one section per new tool, with its input, what it returns, and that it never writes files (except `/api/plan/apply`, which the UI calls on Accept)
- [ ] `mcp-tools.md`: a short "Planning from chat" flow, from guide → questions → answers → propose_plan → Accept
- [ ] `docs/api-reference.md`: `POST /api/plan/apply`, if that file documents the REST routes
- [ ] `README.md`: count the tools with `grep -c`, update both counts to match, and add the three tools plus the missing `vibedoc_propose_edit` to the table. Add one line to "What you get" about planning from the chat.
- [ ] Bump the "Last updated" date on each doc you edit

**Out of scope:** the landing site (R042).

## Files
- `docs/architecture/mcp-tools.md`
- `docs/api-reference.md` (if it documents routes)
- `README.md`

## Implementation notes
- `grep -c 'name: "vibedoc_' src/app/api/mcp/route.ts` is the tool count. Don't assume one.

## Acceptance criteria
- [ ] The README tool count equals the `grep -c` result, and the table lists every tool
- [ ] Each new tool has a section with its input and behavior
- [ ] The chat-planning flow is described end to end

## Verify
```bash
grep -c 'name: "vibedoc_' src/app/api/mcp/route.ts
grep -n "vibedoc_propose_plan\|vibedoc_ask_questions\|vibedoc_get_planning_guide\|vibedoc_propose_edit" README.md docs/architecture/mcp-tools.md
```
