# T228: Cursor and highlight in recorded videos
**Status:** 📋 Todo
**Phase:** R079 — Watchable evidence videos
**Size:** M (2–3 hrs)
**Depends on:** T227
**Covers:** S3, S4

## Goal
When presentation mode is on, the run video shows an animated cursor, the target element highlighted and the action title, paced so a person can follow, while step screenshots stay exactly as clean as today.

## Context
- Epic: `plans/roadmap/R079-watchable-evidence-video.md`
- Decisions from the breakdown: playback defaults to 1× with auto-pause on, remembered per browser in a cookie (like `vibedoc-lang`; CLAUDE.md bans `localStorage`); presentation mode is on by default and off for the suite (`VIBEDOC_TASK_MAP`), the blank-page check (`VIBEDOC_BLANK=1`), CI (`CI` set) and `VIBEDOC_PRESENT=0`; an app on Playwright < 1.59 records plain (feature-detected, no init-script cursor of our own); step screenshots stay clean.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`) and read it with `useT()`" — player text goes in `src/i18n/tests.ts`. "Pure libs never import values from each other" (checks run with `node *.check.mts`).
- One browser script for the epic: `e2e/watchable-video.mjs` (created by T225); each task adds its own checks to it.

## Scope
- [ ] Fixture: when `presentation.on`, call `page.screencast.showActions({ cursor: 'pointer', duration: <ms>, position: 'top-right', style: { point, highlight, title } })` once the page exists (before the first step)
- [ ] Pick styles that read on light and dark apps (a ring with a dark outline, a translucent highlight), duration ~600 ms; constants at the top of the fixture
- [ ] Clean screenshots: hide decorations around each step's `page.screenshot` (`hideActions()` then `showActions()` again), and confirm by test that a screenshot has none
- [ ] Assertion counting and the honesty pass are unaffected (the blank pass is already off via T227)
- [ ] Add S3/S4 checks to `e2e/watchable-video.mjs`: a real Run on a fixture spec (pattern of `e2e/run-tests.mjs`) → passes as before; its step screenshot has no decoration element/pixels; the run is slower than a plain run by roughly the pacing

**Out of scope:** Chapters and the hold after each step (T229); the site demo video.

## Files
- `src/testing/playwright-fixture.ts` — `showActions` / `hideActions` around screenshots
- `e2e/watchable-video.mjs` — S3/S4 checks (cursor + highlight part)

## Implementation notes
- Verified in the Playwright docs (1.59+): `recordVideo.showActions` / `page.screencast.showActions(options)` returns a Disposable, `page.screencast.hideActions()` removes the decorations; actions are paced by `duration`. Prefer the `page.screencast` call over the `recordVideo.showActions` context option, so hiding for screenshots works.
- Whether decorations appear in `page.screenshot()` is not documented: test it on a real run first and only keep the hide/show dance if they do (if they never do, note that in the code and drop it).
- The step fixture's `shoot()` is the single place screenshots are taken (both on pass and fail).

## Acceptance criteria
- [ ] A new single Run's video shows the cursor moving to each click, the target highlighted and the action title
- [ ] Its step screenshots have no decoration; the run passes/fails exactly as before; `e2e/honest-tests.mjs`, `e2e/run-tests.mjs`, `e2e/self-fixing.mjs` still pass
- [ ] With `VIBEDOC_PRESENT=0` the video is plain

## Verify
```bash
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/watchable-video.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/run-tests.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/honest-tests.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/self-fixing.mjs
```

## Manual tests
- [ ] S3 — WHEN a single Run records a new video on a frontend app with Playwright 1.59 or newer → THEN the video shows an animated cursor, the target element highlighted, the action title, a chapter card with each step's name, and a short hold after each step
- [ ] S4 — WHEN a run records in presentation mode → THEN its step screenshots carry no cursor, highlight or chapter, and its pass/fail, assertion counts and honesty verdict are the same as a plain run
