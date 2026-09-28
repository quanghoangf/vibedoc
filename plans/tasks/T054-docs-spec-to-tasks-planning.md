# T054: Docs — planning from a spec
**Status:** ✅ Done
**Phase:** R033 — AI-generated task breakdowns
**Size:** S (~1 hr)
**Depends on:** T052, T053

## Goal
The docs describe the three breakdown forms and the two spec entry points, so users and agents know that a spec can become tasks without an existing epic.

## Context
- Epic: `plans/roadmap/R033-ai-generated-task-breakdowns.md`
- Follow how T045 documented the planning tools.

## Scope
- [ ] `docs/architecture/mcp-tools.md`: under `vibedoc_propose_plan`, document `epic` / `newEpic` / neither, with a short JSON example of `newEpic`, and the new validation errors.
- [ ] Wherever T045 described chat planning, add the "Plan from spec" button and the doc-page "Break down with agent".
- [ ] `memory/MEMORY.md` Key conventions: one line saying that a breakdown plan takes an existing epic, a new epic, or none (loose tasks, no Phase).

**Out of scope:** code changes.

## Files
- `docs/architecture/mcp-tools.md`
- the chat-planning doc T045 touched (`git show --stat` on T045's commit to find it)
- `memory/MEMORY.md`

## Acceptance criteria
- [ ] Every T051 option (`epic`, `newEpic`, none) and every T051 validation error is documented.
- [ ] Both entry points (T052, T053) are described.

## Verify
```bash
grep -n "newEpic" docs/architecture/mcp-tools.md
pnpm build
```
