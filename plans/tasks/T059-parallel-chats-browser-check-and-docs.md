# T059: Browser check for 3 parallel breakdowns + docs
**Status:** 📋 Todo
**Phase:** R044 — Parallel agent chats
**Size:** M (2–3 hrs)
**Depends on:** T056, T057, T058

## Goal
One browser check proves the epic's "Done when": three breakdowns run at once, and accepting their three plans creates tasks with no duplicate T-numbers. The docs and MEMORY.md describe parallel chats.

## Context
- Epic: `plans/roadmap/R044-parallel-agent-chats.md`
- Duplicate T-numbers are already prevented: `applyPlan()` in `src/lib/core.ts` assigns real T ids only at Accept, under `withTaskClaimLock`. This task guards that with a regression check. No new locking.
- Browser checks use the `e2e/stub-chat.mjs` helpers (`stubChat`, `makeFixture`, `launchChrome`, `toolTurn`) against a mktemp fixture project, never this repo. Playwright is not a repo dependency (see the header of `stub-chat.mjs`).

## Scope
- [ ] New `e2e/parallel-chats.mjs`:
  1. The fixture has 3 epics with no tasks. Stub `/api/chat` so each call holds its reply until released (see the `hold` pattern in `e2e/plan-buttons.mjs`) and then returns a `vibedoc_propose_plan` breakdown for the epic named in the message.
  2. Use "Break down epics…" (T058) with all 3 checked → assert 3 `/api/chat` calls are in flight before any is released, and 3 tabs show running.
  3. Release all → each tab shows review (T056) → accept all 3 plan cards, in a different tab order than they were created.
  4. Read the fixture's `plans/tasks/`: T ids are unique and contiguous, and each epic's `**Tasks:**` lists only its own.
  5. Close a tab (T057) → it disappears and the others stay.
- [ ] `docs/architecture/mcp-tools.md` (or the chat section that T045 wrote): describe tabs, new-tab-if-busy, `askAgent({ newChat })`, the 4-chat cap, and close = stop.
- [ ] `memory/MEMORY.md`: in the "Agent chat sidebar" notes, replace "one process spawn per turn… no Stop button" with the parallel-chat behavior. Add a Key conventions line for `src/lib/chats.ts` (pure, self-check `node src/lib/chats.check.mts`).

**Out of scope:** running against a real `claude` (the stub is the check), and CI wiring for e2e.

## Files
- `e2e/parallel-chats.mjs`: new.
- `docs/architecture/mcp-tools.md`
- `memory/MEMORY.md`

## Implementation notes
- For step 3, accepting out of order is the point: it proves ids are assigned at accept time, not at propose time.
- `stubChat(page, (call, body) => …)` gives you the message body, so pull the epic id out of `body.message`.

## Acceptance criteria
- [ ] `node e2e/parallel-chats.mjs` passes and prints one `ok` line per step.
- [ ] The existing e2e scripts still pass: `plan-buttons.mjs`, `stub-chat.mjs`, `ask-questions.mjs`.
- [ ] MEMORY.md no longer says the chat is single-turn-at-a-time.

## Verify
```bash
pnpm build
# dev server on :3000
for f in parallel-chats plan-buttons stub-chat ask-questions; do PW_DIR=<dir with playwright> node e2e/$f.mjs || break; done
```
