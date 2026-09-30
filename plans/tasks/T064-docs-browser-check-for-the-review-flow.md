# T064: Docs + browser check for manual tests and review
**Status:** ✅ Done
**Phase:** R043 — Task verification & review
**Size:** S
**Depends on:** T061, T063

## Goal
The manual test report and the optional Review column are documented, and one full browser run proves the epic's "Done when". An agent finishing a task leaves a checklist, the checklist shows as a badge and on `/manual-tests`, and ticking there updates the task file.

## Context
- Epic: `plans/roadmap/R043-task-verification-and-review.md`
- Docs to touch:
  - `docs/.../mcp-tools.md`: the `manualTests` param and the `review` status on `vibedoc_update_task`
  - README: the workflow section
  - CLAUDE.md: the list of what VibeDoc writes into the project (task `## Manual tests` / `## Review` sections), plus the new `/manual-tests` page in the repo structure

## Scope
- [ ] Update mcp-tools.md, README and CLAUDE.md as listed
- [ ] Add a short "Manual tests & review" section. It covers:
  - the report format
  - that it's encouraged, never required
  - that nothing blocks done
  - the optional lifecycle: in-progress → review → approve (done) / send back (todo)
- [ ] Browser run on the fixture, in 3 steps:
  - `/work-epic` finishes tasks with reports → badges → tick everything on `/manual-tests` → badges turn green
  - Move one task to review → send it back → the agent reclaims it with the note → approve
  - Drag a task without a report straight to Done → allowed
- [ ] Log an ADR via `vibedoc_log_decision`: "Manual test checklist instead of a done gate. Report stored in the task file, Review is optional." Record the rejected option (verify output + mandatory approval) and why it was rejected: the verify output was self-reported, so it added no real trust

**Out of scope:** the demo site (R042).

## Acceptance criteria
- [ ] The docs mention every new status, param, route and page
- [ ] The browser run passes with no console errors
- [ ] The ADR exists

## Verify
```bash
pnpm build && pnpm lint
grep -n -i "manual tests\|review" docs/**/mcp-tools.md README.md CLAUDE.md
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Read docs/architecture/mcp-tools.md → Manual tests & review explains the report, the optional review lifecycle, and that nothing blocks done
- [ ] Open README → What you get lists Manual tests & review
- [ ] Open docs/architecture/decisions/ADR-005 → it records the rejected done gate and why
### Regression risk
- [ ] The ADR index (docs/architecture/decisions/_INDEX.md) still lists ADR-001 to ADR-004
