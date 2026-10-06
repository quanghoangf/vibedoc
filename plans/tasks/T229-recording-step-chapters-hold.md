# T229: Step chapters and a hold after each step
**Status:** 👀 Review
**Phase:** R079 — Watchable evidence videos
**Size:** M (2–3 hrs)
**Depends on:** T228
**Covers:** S3, S4
**Owner:** ai:claude-code
**Due:** 2026-10-09
**Started:** 2026-10-06

## Goal
In presentation mode each step opens with a chapter card naming it, and the result holds still for a moment after the step, so the video reads as one step after another.

## Context
- Epic: `plans/roadmap/R079-watchable-evidence-video.md`
- Decisions from the breakdown: playback defaults to 1× with auto-pause on, remembered per browser in a cookie (like `vibedoc-lang`; CLAUDE.md bans `localStorage`); presentation mode is on by default and off for the suite (`VIBEDOC_TASK_MAP`), the blank-page check (`VIBEDOC_BLANK=1`), CI (`CI` set) and `VIBEDOC_PRESENT=0`; an app on Playwright < 1.59 records plain (feature-detected, no init-script cursor of our own); step screenshots stay clean.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`) and read it with `useT()`" — player text goes in `src/i18n/tests.ts`. "Pure libs never import values from each other" (checks run with `node *.check.mts`).
- One browser script for the epic: `e2e/watchable-video.mjs` (created by T225); each task adds its own checks to it.

## Scope
- [ ] Fixture `step()`: when `presentation.on`, `page.screencast.showChapter(name)` at the start of the step (before `fn`), with a short duration so it doesn't hide what the step does
- [ ] A hold after the step's work and before its screenshot (`STEP_HOLD_MS` ≈ 700 ms, constant at the top of the fixture), so the step span (`startMs`/`endMs`) includes it and the player's pause point (T226) lands on a still frame
- [ ] Chapters never appear in step screenshots (same check as T228)
- [ ] The hold doesn't run in plain mode; retries (`--retries`) still fold correctly
- [ ] Add the chapter/hold checks to `e2e/watchable-video.mjs`

**Out of scope:** The site demo video; audio or narration.

## Files
- `src/testing/playwright-fixture.ts` — chapter + hold in the `step` fixture
- `e2e/watchable-video.mjs` — checks

## Implementation notes
- `page.screencast.showChapter(title, { description?, duration? })` exists from 1.59 (verified in the docs); check its options in the installed types before using `duration`.
- The hold is a deliberate wait in the fixture (not in specs), so specs keep the "no fixed sleeps" rule; mark it with a comment naming why.
- Step timing: `startMs` is taken before the chapter, `endMs` after the hold and screenshot, so `stepSpans().at` (end − 40 ms) falls inside the hold.

## Acceptance criteria
- [ ] Each step in a new single Run's video starts with a chapter card showing its name, and the result holds ~0.7 s before the next step
- [ ] Step screenshots and pass/fail are unchanged; the suite and blank pass have no chapters or hold
- [ ] `e2e/run-tests.mjs`, `e2e/regression-suite.mjs` and `e2e/self-fixing.mjs` still pass

## Verify
```bash
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/watchable-video.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/run-tests.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/regression-suite.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/self-fixing.mjs
```

## Manual tests
_2026-10-06 — ai_
### Steps
- [ ] S3 — WHEN a single Run records a new video on a frontend app with Playwright 1.59 or newer → THEN the video shows an animated cursor, the target element highlighted, the action title, a chapter card with each step's name, and a short hold after each step
- [ ] S4 — WHEN a run records in presentation mode → THEN its step screenshots carry no cursor, highlight or chapter, and its pass/fail, assertion counts and honesty verdict are the same as a plain run
- [ ] Run a done task's spec from Test review and play the new video → each step opens with a grey card "01 · <step name>", "02 · …", and the result holds still for a moment before the next card
- [ ] With "Stop at steps" on, the player stops on that held, still frame (not mid-motion)
- [ ] The step screenshots of that run show the app only (no chapter card)
### Regression risk
- [ ] A spec that builds its page with page.setContent still passes (its video just has no chapters after the first setContent: a Playwright limitation, noted in the fixture)
