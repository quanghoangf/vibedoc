# T080: Owner / PIC on tasks, epics and docs
**Status:** ✅ Done
**Phase:** R055 — Item properties
**Size:** M
**Depends on:** T075

## Goal
Every task, epic and doc shows who is in charge: a human, or which agent. An agent that claims a task becomes its owner automatically.

## Context
- Epic: `plans/roadmap/R055-item-properties.md`
- Task meta: `core.ts:359` and `createTask` (`core.ts:529`); roadmap meta parse near `core.ts:1292`
- Agent claim: `claimNextTask` (`core.ts:471`) and `vibedoc_update_task` in `src/app/api/mcp/route.ts`
- Docs have no meta block today

## Scope
- [ ] `**Owner:** human | ai:<agent>` in the task and epic meta block; parse into `owner`
- [ ] Set owner to the agent on claim / in-progress by an agent; set it to human on a drag in the UI only when empty
- [ ] Docs: owner derived from the last editor in the activity log, shown in the doc header (no file change)
- [ ] Owner filter and group in board views (`src/lib/board-views.ts`)

## Acceptance criteria
- [ ] `vibedoc_next_task` leaves `**Owner:** ai:claude` on the claimed task
- [ ] Filtering the board by owner works and survives a reload (URL state)

## Verify
```bash
pnpm build && pnpm lint
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Run /work-epic on an epic from Claude Code → the claimed task file gets **Owner:** ai:claude and its card shows a bot icon + "claude"
- [ ] /board: a task with no owner → open it → "start" → its file gets **Owner:** human and the card shows a person icon
- [ ] A task owned by human that an agent starts → owner becomes ai:<agent>
- [ ] Filter → Add rule → property Owner → "AI agent" → only agent-owned tasks show; reload → the filter is still there
- [ ] Table view → Group → Owner → sections Human, <agent> (AI), No owner; Properties → Owner toggles the column
- [ ] /roadmap: an epic with **Owner:** in its file shows the owner next to its status in the sheet
- [ ] /docs: open a doc saved by an agent → the header says "AI · <time>"; edit and save it yourself → "Human · just now"
### Regression risk
- [ ] Moving tasks between columns and the review approve / send back still work and do not change an existing owner
- [ ] The Activity page still lists events (new "Edited <doc>" entries, at most one per doc per 10 minutes of autosaves)
