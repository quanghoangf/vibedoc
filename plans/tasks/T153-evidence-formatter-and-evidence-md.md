# T153: Evidence formatter + EVIDENCE.md written after each run
**Status:** ✅ Done
**Phase:** R060 — Evidence report per task
**Size:** M (2–3 hrs)
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
After every Playwright run, a task has an `EVIDENCE.md` next to its runs that proves the feature works: each checklist item with its result and screenshot, the run's time, commit and video, and a history of the kept runs. It is readable in any markdown viewer, without VibeDoc.

## Context
- Epic: `plans/roadmap/R060-evidence-report-per-task.md`
- Interview decisions:
  - The file lives at `<runsRoot>/<projectKey>/<taskId>/EVIDENCE.md`, outside git like the screenshots and video. Image and video links are relative (`<runId>/01-open.png`).
  - One pure formatter, `src/lib/evidence.ts`, produces the markdown. The fixture (this task) and core (T154) both call it, so the file and the VibeDoc view never drift.
  - VibeDoc core never writes this file: it formats on read (T154). Only the fixture writes it.
- Step ↔ checklist matching: `/work-epic` writes one `step('<item text>')` per 🤖 item, with the text copied without the `🤖` (`~/.claude/skills/work-epic/SKILL.md` step 3). So a step matches an item when their texts are equal after trimming.
- Project rule: pure libs never import values from each other (`node *.check.mts` runs without a bundler). `evidence.ts` takes already-parsed checklist items. Use type-only imports from `manual-tests.ts` and `runs-paths.ts`.
- The fixture is compiled by `tsc -p tsconfig.playwright.json` (files: the fixture only, follows imports). Relative imports in the fixture use the `.js` extension.

## Scope
- [ ] `src/lib/evidence.ts` (pure):
  - `matchItems(items, run)` → one row per checklist item: `{ item, result: "passed" | "failed" | "missing" | "manual", step }`. 🤖 items take their step's status, or `missing` when no step has that text. Manual items are `manual`, carrying `checked`. Steps that match no item are returned separately as `extra`.
  - `formatEvidence({ taskId, title, items, spec, runs, runId?, src? })` → markdown. `runs` are newest first. `runId` picks the run detailed at the top (default: the newest). `src(runId, file)` maps a media file to a link (default: `` `${runId}/${file}` ``).
- [ ] Doc layout:
  - H1: `T153 — <title>: evidence`.
  - A one-line summary: result, `passed/total` steps, run time (`startedAt` → duration), short commit, spec path.
  - `## Checklist`: each item with a result glyph (✅ ❌ ⚠️ missing, ☐/☑ manual), then its screenshot `![…](src)` under it, and the error in a fenced block for a failed step.
  - A `▶ Video` link.
  - `## History`: a table with time, result, steps, commit, and the run folder link, newest first; the detailed run is marked.
  - No runs at all → a single line saying there is no run yet.
- [ ] `src/lib/evidence.check.mts`. It must cover:
  - matching by text, including surrounding whitespace
  - a missing step and an extra step
  - manual ticked and unticked items
  - a failed step's error in a fenced block
  - the history order
  - picking an older `runId`
  - zero runs
  - a custom `src`
- [ ] Fixture: after `pruneRuns`, read the task file `plans/tasks/<taskId>-*.md` under `projectRoot()`. If it exists, parse its `## Manual tests` section with `parseManualTests` from `../lib/manual-tests.js`, read every kept `run.json` of the task, and write `EVIDENCE.md`. If there is no task file (e.g. `no-task`), still write it with the run steps as `extra`. Never fail the test on an error here: catch it, `console.warn`, and move on.

**Out of scope:** serving or showing the doc (T154, T155), MCP (T154), the board and panel entry points (T156), PDF/HTML export, and screenshot diffs (epic out of scope).

## Files
- `src/lib/evidence.ts`: new, pure.
- `src/lib/evidence.check.mts`: new.
- `src/testing/playwright-fixture.ts`: write `EVIDENCE.md` after `pruneRuns` (around the `run.json` write).

## Implementation notes
- `RunManifest` / `RunStep` shapes: `src/lib/runs-paths.ts`. Keep run.json unchanged; the doc is derived from it.
- `parseManualTests` lives in `src/lib/manual-tests.ts` (it has `items`, `spec`, `autoRun`). Check that `pnpm build:playwright` still compiles once the fixture imports it: it must not pull in anything React or Next.
- Escape `|` in table cells and strip ANSI codes from errors (run.json is already plain, but hand-edited files may not be).
- Image alt text = the item text, so the doc reads well without images.

## Acceptance criteria
- [ ] Running `e2e/fixtures/capture-demo.spec.ts` with `VIBEDOC_TASK_ID=T138` leaves `<runsRoot>/vibedoc/T138/EVIDENCE.md`. Opened in VS Code preview, every step shows its screenshot and the video link opens.
- [ ] A second run adds a row to `## History`. After pruning to N runs, the history has N rows.
- [ ] With `CAPTURE_DEMO_FAIL=1`, the failed step shows ❌ with its Expected/Received error.
- [ ] `node src/lib/evidence.check.mts` prints ok.

## Verify
```bash
node src/lib/evidence.check.mts
pnpm build:playwright && pnpm lint && pnpm build
VIBEDOC_TASK_ID=T138 npx playwright test e2e/fixtures/capture-demo.spec.ts
cat ~/.vibedoc/runs/vibedoc/T138/EVIDENCE.md
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Run `VIBEDOC_RUNS_DIR=$(mktemp -d) VIBEDOC_TASK_ID=T138 npx playwright test e2e/fixtures/capture-demo.spec.ts`, then open `<dir>/vibedoc/T138/EVIDENCE.md` in VS Code preview → the title reads "T138 — … : evidence", both demo steps show their screenshot, and the "▶ Video of this run" link plays
- [ ] Run it again with `CAPTURE_DEMO_FAIL=1` (same dir) → the top line reads ❌ failed 1/2, step 2 shows the Expected/Received error in a code block above its screenshot, and History has 2 rows with the failed one marked shown
- [ ] Run once more with `VIBEDOC_RUNS_KEEP=1` → History has a single row and the folder holds one run plus EVIDENCE.md
- [ ] T138's own checklist items (all manual) appear under Checklist as ☐ … manual, not ticked yet; the demo steps sit under "Steps not in the checklist" since their text matches no item
### Regression risk
- [ ] A run without `VIBEDOC_TASK_ID` still records under `no-task/` and the test result is unchanged (EVIDENCE.md errors only warn)
- [ ] /manual-tests and the task panel still show T138's runs and video as before
