# T145: Automated items + spec link in the manual tests section
**Status:** ✅ Done
**Phase:** R058 — Auto-tests from the checklist
**Size:** M
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
A task's `## Manual tests` checklist can mark items as automated (🤖) and link the Playwright spec that covers them, and record the last run result. This is the data shape that the rest of R058 builds on.

## Context
- Epic: `plans/roadmap/R058-auto-tests-from-the-checklist.md`
- Builds on T060: `src/lib/manual-tests.ts` (`setManualTests`, `parseManualTests`) and the `manualTests` param on `vibedoc_update_task`.
- Decided: an automated item is a normal checklist line with a `🤖 ` prefix after the checkbox: `- [ ] 🤖 Open / → board loads`. Items without it stay manual.
- Decided: the spec path and last run live in the section's header line, not in the head meta block: `_2026-10-04 — ai · Spec: \`e2e/vibedoc/T140-foo.spec.ts\` · Auto: passed 2026-10-04_`. Replacing the report replaces them too (same rule as T060).
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches fs; `emitUpdate()` from the API route, never from core; `/api/mcp` is hand-rolled JSON-RPC.

## Scope
- [ ] `parseManualTests()` returns `auto: boolean` per item (🤖 prefix stripped from the text) and `spec`, `autoRun: { result: 'passed' | 'failed', date } | null` for the section, plus counts `{ total, done, auto }`
- [ ] `setManualTests()` accepts optional `spec` and `autoRun` and writes them into the header line
- [ ] `vibedoc_update_task`: optional `spec` (relative path in the target repo) and `autoResult` (`passed` | `failed`) params. They're only valid together with `manualTests`, or they update the header of the existing section
- [ ] `listTasks()` exposes `manualTests: { total, done, auto, spec, autoRun } | null`
- [ ] Extend `src/lib/manual-tests.check.mts`

**Out of scope:** UI (task 2), writing or running specs (tasks 3–4).

## Files
- `src/lib/manual-tests.ts` + `manual-tests.check.mts`
- `src/lib/core.ts`: `saveManualTests()` passes the new fields through, `listTasks()` count
- `src/app/api/mcp/route.ts`: `spec` / `autoResult` params on `vibedoc_update_task` (update the tool description)

## Implementation notes
- T061 toggles checkboxes by index, so the 🤖 prefix must not change item indexing.
- Old sections without 🤖 or Spec parse exactly as before (`auto: 0`, `spec: null`).

## Acceptance criteria
- [ ] `update_task` with a checklist that has 2 🤖 items and `spec` writes the header with the spec path; `listTasks()` reports `auto: 2`
- [ ] `autoResult: "passed"` without `manualTests` updates only the header line of the existing section
- [ ] Existing T060-style sections parse unchanged
- [ ] The self-check covers: 🤖 parsing, the header with/without spec and run, header-only update, and index stability for ticking

## Verify
```bash
node src/lib/manual-tests.check.mts
npm run build && npm run lint
# Fixture as in T060: call vibedoc_update_task with manualTests containing 🤖 items + spec → check the task file
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Call vibedoc_update_task on a test task with manualTests that has `- [ ] 🤖 ...` items and `spec: "e2e/vibedoc/Txxx.spec.ts"`. Open the task file → the line under `## Manual tests` reads `_<date> — ai · Spec: \`e2e/vibedoc/Txxx.spec.ts\`_` and the 🤖 items keep their prefix.
- [ ] Tick the 2nd item on /manual-tests, then call vibedoc_update_task with only `autoResult: "failed"` → the header gets `· Auto: failed <date>`, and the tick and every item stay as they were.
- [ ] Look at the MCP reply after that call → it says `🤖 N automated · spec ... · last run failed <date>`.
- [ ] Call vibedoc_update_task with `autoResult` on a task that has no Manual tests section → you get a clear error, and the task file is not changed.
- [ ] On a task with a hand-written `## Manual tests` section (no date stamp line), call vibedoc_update_task with only spec + autoResult → a real `_<date> — ai · Spec: ... · Auto: ..._` line is inserted and the reply shows the spec and last run.
### Regression risk
- [ ] An existing task with an old-style T060 section (no 🤖, no Spec): its 🧪 done/total badge on the board card and in the table is still correct.
- [ ] /manual-tests: ticking items still ticks the right line, also for items after a 🤖 item. The 🤖 prefix now does not show in the item text there until T146 adds the UI.
- [ ] Sending a new manualTests report without spec removes the old Spec/Auto from the header, as T060 did when a report was replaced.
