# T273: First-screen docs, end-to-end check, close R082
**Status:** 👀 Review
**Phase:** R082 — Smart first screen
**Size:** S (~1 hr)
**Depends on:** T271, T272
**Covers:** S1, S2, S3, S4
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Done:** 2026-10-07

## Goal
Prove the epic's Done-when end to end and update the docs that still say `vibedoc` opens the setup wizard.

## Context
- Epic: `plans/roadmap/R082-smart-first-screen.md`
- Done when: opening VibeDoc in an empty repo, in a repo with docs and in a VibeDoc-managed repo each lands on a different, correct first screen, and none of them opens the wizard.
- Don't edit `docs/specs/` — the human merges the epic's `## Spec changes` (first-run) when it is done.

## Scope
- [ ] `e2e/first-screen.mjs` runs all of S1–S4 clean from fresh fixtures, and asserts no fixture lands on `/setup`
- [ ] Docs: `docs/getting-started.md` (line about the setup wizard), `site/src/content/docs/docs/index.md` (same), `memory/MEMORY.md` Key conventions (one line: `src/lib/first-screen.ts`, `/start`, `vibedoc-last` cookie, the R081 `ConnectSlot` seam)
- [ ] Set R082 `**Status:** done` once every task is done

**Out of scope:** CLI startup text (R080).

## Files
- `e2e/first-screen.mjs`
- `docs/getting-started.md`, `site/src/content/docs/docs/index.md`, `memory/MEMORY.md`
- `plans/roadmap/R082-smart-first-screen.md` (status)

## Acceptance criteria
- [ ] Epic Done-when holds for the three fixtures
- [ ] Docs describe the welcome and that the wizard is optional ("Write project docs")

## Verify
```bash
pnpm build && pnpm lint
BASE=http://localhost:3082 PW_DIR=. node e2e/first-screen.mjs
pnpm --dir site build
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [ ] S1 — WHEN VibeDoc opens a project that has docs but no roadmap for the first time → THEN the welcome offers "Generate roadmap from your docs" first
- [ ] S2 — WHEN VibeDoc opens a project with no docs or tasks → THEN the welcome offers to plan the first epics with the agent
- [ ] S3 — WHEN VibeDoc opens a project that already has tasks or a roadmap → THEN it opens the board (or the last page used), not the welcome
- [ ] S4 — WHEN the user picks "Write project docs" → THEN the template wizard opens
- [ ] Done-when, by hand: run the packed `vibedoc` in an empty folder, in a folder with only a README + docs/, and in this repo → welcome (plan first epics), welcome (roadmap from docs), board; none opens the wizard
- [ ] Read "Start VibeDoc" in docs/getting-started.md and on the site's docs index → they describe the welcome and the optional wizard
### Regression risk
- [ ] Settings → Getting started still renders the guide

## Notes
- Verified 2026-10-07 on :3082: `e2e/first-screen.mjs` (S1–S4, plus a bad last-page cookie → /board) and the T270–T272 specs all pass from fresh temp projects; `pnpm build`, `pnpm --dir site build`, `first-screen` / `i18n` / `shortcuts` checks pass; lint has only the 14 known react-hooks errors.
- R082 left `in-progress`, not `done`: T270–T273 wait in review for their manual items. Set it done once they are approved, then merge its `## Spec changes` (first-run) from the epic sheet.
