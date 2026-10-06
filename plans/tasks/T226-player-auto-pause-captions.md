# T226: Player auto-pause at each step and step caption
**Status:** 👀 Review
**Phase:** R079 — Watchable evidence videos
**Size:** M (2–3 hrs)
**Depends on:** T225
**Covers:** S2
**Owner:** ai:claude-code
**Due:** 2026-10-09
**Started:** 2026-10-06

## Goal
While a run's video plays, it stops at the end of each step with that step's name over the video, so a reviewer can check one step at a time and press Play for the next.

## Context
- Epic: `plans/roadmap/R079-watchable-evidence-video.md`
- Decisions from the breakdown: playback defaults to 1× with auto-pause on, remembered per browser in a cookie (like `vibedoc-lang`; CLAUDE.md bans `localStorage`); presentation mode is on by default and off for the suite (`VIBEDOC_TASK_MAP`), the blank-page check (`VIBEDOC_BLANK=1`), CI (`CI` set) and `VIBEDOC_PRESENT=0`; an app on Playwright < 1.59 records plain (feature-detected, no init-script cursor of our own); step screenshots stay clean.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`) and read it with `useT()`" — player text goes in `src/i18n/tests.ts`. "Pure libs never import values from each other" (checks run with `node *.check.mts`).
- One browser script for the epic: `e2e/watchable-video.mjs` (created by T225); each task adds its own checks to it.

## Scope
- [ ] Pure `nextPause(spans, prevMs, nowMs)` in `src/lib/test-review.ts`: the first span `at` crossed between two time updates (prev < at ≤ now), else null; checks in `src/lib/test-review.check.mts` (or the existing check file for that lib)
- [ ] `RunPlayer`: while playing with auto-pause on, pause at `at` and seek exactly there; Play from a pause point continues to the next step (don't re-pause on the same `at`)
- [ ] An auto-pause toggle next to the speed control, stored in the T225 cookie (`autoPause`, default on)
- [ ] Caption over the video (bottom, readable on any frame: dark scrim, `aria-live="polite"`): `Step N · <name>` for the step at the playhead, shown while paused at a step and briefly when a step starts; the step name is user content (`data-user-content`)
- [ ] Runs without timing (old runs: no `startMs`/`endMs`) keep today's behaviour, no toggle effect
- [ ] Add S2 checks to `e2e/watchable-video.mjs`

**Out of scope:** Anything in the recording (T227–T229).

## Files
- `src/lib/test-review.ts` (+ its check) — `nextPause`
- `src/components/manual-tests/RunPlayer.tsx` — pause logic, toggle, caption
- `src/lib/player-prefs.ts` — already has `autoPause` (T225)
- `src/i18n/tests.ts` — toggle label, caption format
- `e2e/watchable-video.mjs` — S2 checks

## Implementation notes
- `stepSpans()` already gives each step `{ start, end, at }`, where `at` is the screenshot moment (`endMs - 40`, clamped). Pause at `at`, the same frame `goTo()` seeks to, so the stage matches the step's screenshot.
- `timeupdate` fires at ~4 Hz, so a pause found there lands up to 250 ms late: seek back to `at` after pausing. The rAF loop that moves the playhead is a tighter place to check if you prefer.
- `onPlayerKey` (←/→, space) and the step list must keep working; space at a pause point plays on.

## Acceptance criteria
- [ ] With auto-pause on, playback stops at each step's end with `Step N · <name>` shown; Play continues to the next step
- [ ] With auto-pause off, it plays through as today
- [ ] Old runs without step timing are unchanged
- [ ] `nextPause` self-check passes; `e2e/watchable-video.mjs` covers S2

## Verify
```bash
node src/lib/test-review.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/watchable-video.mjs
```

## Manual tests
_2026-10-06 — ai · Spec: `e2e/vibedoc/T226-player-auto-pause-captions.spec.ts` · Auto: passed 2026-10-06_
### Steps
- [ ] S2 — WHEN the video plays with auto-pause on and reaches the end of a step → THEN it pauses on that step's screenshot moment with the step's name shown over the video, and Play goes on to the next step
- [x] 🤖 Open Test review → All → a task with a recorded run → "Pause at each step" is on
- [x] 🤖 Press Play → the video stops at the end of step 1 with "Step 1 · <its name>" over it
- [x] 🤖 Press Play again → it plays on and stops at the end of step 2 with "Step 2" shown
- [ ] Untick "Stop at steps" and press Play → the video plays through to the end; after a reload the box is still unticked
- [ ] The caption is readable on a light page and on a dark page, and a long step name is cut with "…"
### Regression risk
- [ ] An older run without step timing still opens a step's screenshot when its row is clicked, and has no "Stop at steps" box
