# T230: Watchable video docs, end-to-end check, close R079
**Status:** 👀 Review
**Phase:** R079 — Watchable evidence videos
**Size:** S (~1 hr)
**Depends on:** T225, T226, T227, T228, T229
**Covers:** S1, S2, S3, S4, S5
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-06

## Goal
Prove the epic's Done-when end to end and document how to use (and turn off) presentation recording.

## Context
- Epic: `plans/roadmap/R079-watchable-evidence-video.md`
- Decisions from the breakdown: playback defaults to 1× with auto-pause on, remembered per browser in a cookie (like `vibedoc-lang`; CLAUDE.md bans `localStorage`); presentation mode is on by default and off for the suite (`VIBEDOC_TASK_MAP`), the blank-page check (`VIBEDOC_BLANK=1`), CI (`CI` set) and `VIBEDOC_PRESENT=0`; an app on Playwright < 1.59 records plain (feature-detected, no init-script cursor of our own); step screenshots stay clean.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`) and read it with `useT()`" — player text goes in `src/i18n/tests.ts`. "Pure libs never import values from each other" (checks run with `node *.check.mts`).
- One browser script for the epic: `e2e/watchable-video.mjs` (created by T225); each task adds its own checks to it.

## Scope
- [ ] `e2e/watchable-video.mjs` runs all of S1–S5 in one pass (it grew task by task; make sure it runs clean from a fresh fixture)
- [ ] Docs: `site/src/content/docs/docs/concepts/evidence.md` — the player's speed and auto-pause, presentation recording (what it adds, when it's off, `VIBEDOC_PRESENT=0`, Playwright ≥ 1.59); `memory/MEMORY.md` Key conventions — one line (where the switch lives, the env vars, clean screenshots, the cookie); the fixture's header comment
- [ ] Set R079 `**Status:** done` once every task is done

**Out of scope:** The site demo video (`site/scripts/record-demo.mjs`).

## Files
- `e2e/watchable-video.mjs`
- `site/src/content/docs/docs/concepts/evidence.md`
- `memory/MEMORY.md`
- `src/testing/playwright-fixture.ts` (header comment only)
- `plans/roadmap/R079-watchable-evidence-video.md` (status)

## Implementation notes
- The site build is `pnpm --dir site build`; the evidence page is plain Markdown.

## Acceptance criteria
- [ ] Epic Done-when holds: an existing run's video plays at 0.5×, stops at each step's end with its name, and a new single Run records a video with a cursor, click marks and step chapters while its screenshots and pass/fail are unchanged
- [ ] The docs describe the player controls and presentation recording, including how to turn it off

## Verify
```bash
pnpm lint && pnpm build && pnpm --dir site build
PW_DIR=<dir with node_modules/playwright> node e2e/watchable-video.mjs
```

## Manual tests
_2026-10-06 — ai_
### Steps
- [ ] S1 — WHEN a reviewer picks 0.5× on a run's video on Test review → THEN the video plays at half speed, and after a reload the player still starts at 0.5×
- [ ] S2 — WHEN the video plays with auto-pause on and reaches the end of a step → THEN it pauses on that step's screenshot moment with the step's name shown over the video, and Play goes on to the next step
- [ ] S3 — WHEN a single Run records a new video on a frontend app with Playwright 1.59 or newer → THEN the video shows an animated cursor, the target element highlighted, the action title, a chapter card with each step's name, and a short hold after each step
- [ ] S4 — WHEN a run records in presentation mode → THEN its step screenshots carry no cursor, highlight or chapter, and its pass/fail, assertion counts and honesty verdict are the same as a plain run
- [ ] S5 — WHEN the run is the regression suite, the blank-page check, CI, `VIBEDOC_PRESENT=0`, or the app's Playwright is older than 1.59 → THEN the video is recorded plain, and run.json and the player say why
- [ ] The docs site's Evidence page explains the player controls, presentation recording and how to turn it off
### Regression risk
- [ ] The regression suite still runs at its old speed
