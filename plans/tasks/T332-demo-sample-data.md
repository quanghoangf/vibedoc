# T332: Sample project shows every part of VibeDoc
**Status:** 👀 Review
**Phase:** R085 — Demo playground
**Size:** M (2–3 hrs)
**Depends on:** T330
**Covers:** S1
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
The sample project looks lived-in on the day it is opened: a roadmap in progress, tasks in every status, saved agent chats, an activity history, manual tests waiting for review, memory entries and a linked doc graph, with dates near today.

## Context
- Epic: `plans/roadmap/R085-demo-playground.md` — "a sample project with a roadmap in progress, tasks across every status, agent chats, test runs with evidence videos, memory entries and a doc graph".
- `examples/demo-project` already has: 6 roadmap items (R004 in progress), 12 tasks covering todo / in-progress / review / done / blocked / paused / cancelled, 4 memory entries, docs with links and an ADR. It has **no** `.vibedoc/chats/`, no `.vibedoc-activity.json`, no `## Manual tests`, no `## Scenarios` on an epic.
- The same folder feeds R042's hosted read-only demo, so additions show there too (it blocks `/chat`, which is fine).
- The dates are fixed (e.g. R004 `**Due:** 2026-10-15`), so in a month the demo is all overdue. Decision: `prepareDemo()` (T330, `bin/demo.mjs`) shifts dates in the **copy** by whole days so the anchor date lands on today. The source stays fixed.
- Formats to follow: chats = `toSaved()` in `src/lib/chats.ts` (see the saved-chat fixtures in `e2e/i18n.mjs`); activity = `appendActivity()` events in core.ts and titles parsed by `src/lib/activity.ts` (titles must match the real formats); manual tests = `src/lib/manual-tests.ts`; scenarios / covers = `src/lib/scenarios.ts`.

## Scope
- [ ] `examples/demo-project/.vibedoc/chats/`: 2–3 saved chats: one about R004 that proposed a breakdown plan (resolved), one about a task with a short Q&A; all finished, none "running"
- [ ] `examples/demo-project/.vibedoc-activity.json`: ~30 events over the last two weeks (task moves by `ai:claude-code` and human, doc edits, memory entries saved, session starts), so /activity and the sidebar look alive
- [ ] `## Scenarios` on R004 and `**Covers:**` on its tasks; `## Manual tests` on the review task (some ticked, some not) and on two done tasks
- [ ] One more memory entry that links to a task and a doc (memory graph shows edges)
- [ ] `.vibedoc-demo-anchor` (one `YYYY-MM-DD` line) in the sample; `prepareDemo()` shifts every `YYYY-MM-DD` and ISO timestamp in the copied `.md` / `.json` files by `today − anchor` days (a pure `shiftDates(text, days)` in `bin/demo.mjs`)
- [ ] Every `(app)` page opened on the demo has content (board, roadmap, graph, memory, memory graph, activity, chat list, manual tests)

**Out of scope:** the evidence run and its video (T333); new UI.

## Files
- `examples/demo-project/.vibedoc/chats/*.json` — new
- `examples/demo-project/.vibedoc-activity.json` — new
- `examples/demo-project/plans/roadmap/R004-shared-lists.md`, `plans/tasks/T00*.md` — scenarios, covers, manual tests
- `examples/demo-project/memory/entries/E005-*.md` — new
- `examples/demo-project/.vibedoc-demo-anchor` — new
- `bin/demo.mjs` — `shiftDates()` applied during the copy; cases in `bin/demo.check.mts`

## Implementation notes
- `shiftDates` must keep a date-only string date-only (local calendar date, see MEMORY.md "compare as strings, never `new Date("YYYY-MM-DD")`"): add days with UTC math on the parts, not via a local `Date`.
- Don't shift run ids (`20261004T101500Z` folder names under T333's runs): only the copied project files.
- Check that the hosted demo (`pnpm demo`) still renders after the additions.

## Acceptance criteria
- [ ] `node bin/vibedoc.mjs --demo --port 3085`: /board has a card in every status column, /chat lists the saved chats, /activity shows recent events, /manual-tests shows the review task as "Needs you", /memory?view=graph shows edges, /graph shows the docs linked
- [ ] Dates in the demo copy are near today (R004 due a week or so ahead), the source files are unchanged
- [ ] `node bin/demo.check.mts` covers `shiftDates` (date-only, ISO timestamp, month/year rollover)
- [ ] No browser console errors on those pages; `pnpm build` passes

## Manual tests
_2026-10-07 — ai · Spec: `e2e/vibedoc/T332-demo-sample-data.spec.ts` · Auto: passed 2026-10-07_
### Steps
- [ ] S1 — WHEN the user runs `vibedoc --demo` → THEN the browser opens a populated sample project with a Demo banner
- [x] 🤖 Open /board → Todo, In progress, Review, Blocked, Paused and Done each have tasks
- [x] 🤖 Open /chat → three saved chats: "What should I work on next?", "Task T006", "Epic R004"
- [x] 🤖 Open /roadmap?item=R004 → the sheet lists scenarios S1–S3, S1 and S2 passed
- [x] 🤖 Open /manual-tests → T006 "Live sync for shared lists" needs you
- [x] 🤖 Open /activity → events from the last days, newest a day ago
- [ ] Open /memory → Graph: E005 links to T006 and the Lists API doc; /graph shows the docs linked
- [ ] Open the "Epic R004" chat → the accepted breakdown plan lists T004–T008; dates read naturally (R004 due about 11 days out, T005 overdue)
- [ ] The header doesn't say "agent working" (no sample event is from the last hours)
### Regression risk
- [ ] Hosted read-only demo (`pnpm build && pnpm demo`) still shows the board and roadmap, with no chats

## Verify
```bash
node bin/demo.check.mts
pnpm build && node bin/vibedoc.mjs --demo --port 3085   # open each page listed above
```

## Notes
- The anchor is 2026-10-04, one day after the newest sample event, so the shifted activity log never makes the header say "agent working" in a demo that runs no agents.
- `bin/demo.check.mts` now proves "the source is unchanged" by a before/after snapshot of the sample's files instead of `git status`, so it also passes while the sample has uncommitted edits.
