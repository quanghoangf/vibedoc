# T313: First-week Done-when end to end, docs, close R084
**Status:** 📋 Todo
**Phase:** R084 — First-week checklist
**Size:** S (~1 hr)
**Depends on:** T311, T312
**Covers:** S1, S2, S3

## Goal
Prove the epic's Done-when: a user who follows only the checklist ends with a done task that has evidence, and all six items ticked with nothing ticked by hand. Document it.

## Context
- Epic: `plans/roadmap/R084-first-week-checklist.md`
- The e2e plays the agent over `/api/mcp` (session start via `vibedoc_read_memory`, a roadmap item, an epic's tasks, a task done by `ai`, a memory entry via `vibedoc_save_entry`) and records a test run the way `e2e/evidence.mjs` does (capture-demo spec with `VIBEDOC_PROJECT`/`VIBEDOC_TASK_ID`, runs removed in `finally`).

## Scope
- [ ] `e2e/first-week.mjs` runs the whole loop in one pass from a fresh fixture: every row ticks in the open page without a reload, in order, and the next open item follows each tick; ends with the done task's evidence present
- [ ] Docs: `docs/getting-started.md` and the site's getting-started page (`site/src/content/docs/…`) mention the checklist; `memory/MEMORY.md` Key conventions gets one line (pure lib, derived facts, `.vibedoc/first-week.json`, the R081 seam)
- [ ] Set R084 `**Status:** done` once every task is done

## Files
- `e2e/first-week.mjs`
- `docs/getting-started.md`, the site getting-started page
- `memory/MEMORY.md`
- `plans/roadmap/R084-first-week-checklist.md`

## Acceptance criteria
- [ ] Done-when holds end to end in the e2e
- [ ] Docs describe what ticks each step and how to dismiss

## Verify
```bash
pnpm lint && pnpm build && pnpm --dir site build
BASE=http://localhost:3084 PW_DIR=<dir with node_modules/playwright> node e2e/first-week.mjs
```

## Manual tests
### Steps
- [ ] S1 — WHEN the agent marks the user's first task done → THEN "First task done" ticks without a reload
- [ ] S2 — WHEN the user opens the checklist → THEN the first unticked item shows its page or the exact command to copy
- [ ] S3 — WHEN the user dismisses the checklist → THEN it doesn't come back for this project
