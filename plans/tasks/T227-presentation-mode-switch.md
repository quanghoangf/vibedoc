# T227: Presentation mode switch in the test kit
**Status:** 📋 Todo
**Phase:** R079 — Watchable evidence videos
**Size:** S (~1 hr)
**Depends on:** —
**Covers:** S5

## Goal
The test kit decides once per run whether to record a presentation video, writes the decision into run.json, and the player says when a video was recorded plain and why. T228–T229 hang the visuals on this switch.

## Context
- Epic: `plans/roadmap/R079-watchable-evidence-video.md`
- Decisions from the breakdown: playback defaults to 1× with auto-pause on, remembered per browser in a cookie (like `vibedoc-lang`; CLAUDE.md bans `localStorage`); presentation mode is on by default and off for the suite (`VIBEDOC_TASK_MAP`), the blank-page check (`VIBEDOC_BLANK=1`), CI (`CI` set) and `VIBEDOC_PRESENT=0`; an app on Playwright < 1.59 records plain (feature-detected, no init-script cursor of our own); step screenshots stay clean.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`) and read it with `useT()`" — player text goes in `src/i18n/tests.ts`. "Pure libs never import values from each other" (checks run with `node *.check.mts`).
- One browser script for the epic: `e2e/watchable-video.mjs` (created by T225); each task adds its own checks to it.

## Scope
- [ ] Pure `src/lib/presentation.ts`: `presentationMode(env, hasScreencast) → { on: boolean, reason: 'suite' | 'blank' | 'ci' | 'disabled' | 'old-playwright' | null }` (on unless `VIBEDOC_BLANK=1`, `VIBEDOC_TASK_MAP` set, `CI` truthy, `VIBEDOC_PRESENT=0`, or no screencast API); check file `src/lib/presentation.check.mts`
- [ ] Add `lib/presentation.ts` to `FIXTURE_KIT_FILES` in `src/lib/frontend.ts` (the kit VERSION hash then rewrites kits on its own)
- [ ] Fixture: compute the mode once per test (`hasScreencast` = `typeof page.screencast?.showActions === 'function'`), record `presentation: { on, reason }` in run.json (`RunManifest` in `src/lib/runs-paths.ts`, optional field, `parseRunManifest` tolerant of old runs)
- [ ] Player: under the video, a muted line when `presentation.on === false` with a reason (e.g. "Recorded plain: the regression suite runs fast"); nothing for old runs without the field
- [ ] Add S5 checks to `e2e/watchable-video.mjs` (a run.json with each reason → the line; none for old runs)

**Out of scope:** The cursor/highlight (T228) and chapters/hold (T229) themselves.

## Files
- `src/lib/presentation.ts` — new, pure (the fixture imports it as `../lib/presentation.js`, like its other libs)
- `src/lib/presentation.check.mts` — new
- `src/lib/frontend.ts` — `FIXTURE_KIT_FILES`
- `src/testing/playwright-fixture.ts` — decide, write to run.json
- `src/lib/runs-paths.ts` — `RunManifest.presentation?`
- `src/components/manual-tests/RunPlayer.tsx` + `src/i18n/tests.ts` — the reason line
- `e2e/watchable-video.mjs` — S5 checks

## Implementation notes
- `test-runner.ts` spawns with `CI: ''`, so a Run from VibeDoc is not CI; an agent's shell run under real CI is. The suite already passes `VIBEDOC_TASK_MAP`; the blank pass passes `VIBEDOC_BLANK=1` (fixture constant `BLANK`).
- `page.screencast` exists from Playwright 1.59. The kit runs on the frontend app's own `@playwright/test`, so detect, never assume. Keep TypeScript happy for older type packages (a narrow cast, no `@ts-ignore`).
- run.json is written at the end of the `step` fixture (`playwright-fixture.ts`, after `video.saveAs`).

## Acceptance criteria
- [ ] run.json of a single Run has `presentation: { on: true, reason: null }` (on Playwright ≥ 1.59); a suite run has `{ on: false, reason: 'suite' }`; the blank pass writes no run
- [ ] `VIBEDOC_PRESENT=0` and `CI=1` turn it off with their reasons
- [ ] The player shows the reason line for plain runs, nothing for older runs
- [ ] `node src/lib/presentation.check.mts` passes; existing `e2e/run-tests.mjs` and `e2e/regression-suite.mjs` still pass

## Verify
```bash
node src/lib/presentation.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/watchable-video.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/run-tests.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/regression-suite.mjs
```

## Manual tests
- [ ] S5 — WHEN the run is the regression suite, the blank-page check, CI, `VIBEDOC_PRESENT=0`, or the app's Playwright is older than 1.59 → THEN the video is recorded plain, and run.json and the player say why
