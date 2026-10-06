# T225: Player playback speed, remembered per browser
**Status:** 👀 Review
**Phase:** R079 — Watchable evidence videos
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1
**Owner:** ai:claude-code
**Due:** 2026-10-09
**Started:** 2026-10-06

## Goal
A reviewer can slow a run's video down to follow it: the run player on Test review gets a speed control (0.5×, 1×, 1.5×, 2×) that the browser remembers.

## Context
- Epic: `plans/roadmap/R079-watchable-evidence-video.md`
- Decisions from the breakdown: playback defaults to 1× with auto-pause on, remembered per browser in a cookie (like `vibedoc-lang`; CLAUDE.md bans `localStorage`); presentation mode is on by default and off for the suite (`VIBEDOC_TASK_MAP`), the blank-page check (`VIBEDOC_BLANK=1`), CI (`CI` set) and `VIBEDOC_PRESENT=0`; an app on Playwright < 1.59 records plain (feature-detected, no init-script cursor of our own); step screenshots stay clean.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`) and read it with `useT()`" — player text goes in `src/i18n/tests.ts`. "Pure libs never import values from each other" (checks run with `node *.check.mts`).
- One browser script for the epic: `e2e/watchable-video.mjs` (created by T225); each task adds its own checks to it.

## Scope
- [ ] Pure `src/lib/player-prefs.ts`: `PLAYER_SPEEDS = [0.5, 1, 1.5, 2]`, cookie name `vibedoc-player`, `parsePlayerPrefs(cookieValue) → { speed, autoPause }` (defaults 1 and true; unknown speeds fall back to 1), `formatPlayerPrefs(prefs)`, and a `playerCookie(prefs)` string like `langCookie()` in `src/lib/i18n.ts` (path=/, 1 year, SameSite=Lax)
- [ ] `src/lib/player-prefs.check.mts` covering parse/format round trip, defaults and bad input
- [ ] `RunPlayer`: a speed control in the timeline row (a segmented control or `<select>`, labelled), applied as `video.playbackRate` and kept when the run or the source changes (set it again on `loadedmetadata`)
- [ ] Read the cookie after mount (no hydration mismatch), write it on change
- [ ] i18n keys in `src/i18n/tests.ts` (en + vi)
- [ ] Create `e2e/watchable-video.mjs` (fixture project with one task whose run has a video, like `e2e/task-runs.mjs`): pick 0.5× → `video.playbackRate === 0.5`; reload → still 0.5×

**Out of scope:** Auto-pause (T226); anything in the recording (T227–T229).

## Files
- `src/lib/player-prefs.ts` — new, pure; T226 reads `autoPause` from the same cookie
- `src/lib/player-prefs.check.mts` — new
- `src/components/manual-tests/RunPlayer.tsx` — speed control, `playbackRate`
- `src/i18n/tests.ts` — labels
- `e2e/watchable-video.mjs` — new

## Implementation notes
- `RunPlayer` keeps its own `<video>` ref and timeline; `toggle()` / `seek()` / `ready()` are the places that touch the element. `playbackRate` resets when `src` changes, so re-apply it in `onLoadedMetadata` (where `ready()` runs).
- The webm duration probe (`probing`, seeks to 1e9 once) must not be disturbed by the rate.
- Reuse the shape of `langCookie()` / `parseLang()` in `src/lib/i18n.ts` for the cookie helpers. One cookie holds both prefs (e.g. `speed=0.5&pause=1`), so T226 adds no second cookie.
- Fixture runs for the e2e: copy how `e2e/task-runs.mjs` writes a run folder with `run.json` + a small `video.webm` (it records one with Playwright).

## Acceptance criteria
- [ ] Picking 0.5× plays the video at half speed; 2× at double
- [ ] The choice survives a reload and a switch to another task's run
- [ ] English and Vietnamese labels; `node src/lib/i18n.check.mts` passes
- [ ] `node src/lib/player-prefs.check.mts` passes; `e2e/watchable-video.mjs` covers S1

## Verify
```bash
node src/lib/player-prefs.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/watchable-video.mjs
```

## Manual tests
_2026-10-06 — ai · Spec: `e2e/vibedoc/T225-player-playback-speed.spec.ts` · Auto: passed 2026-10-06_
### Steps
- [ ] S1 — WHEN a reviewer picks 0.5× on a run's video on Test review → THEN the video plays at half speed, and after a reload the player still starts at 0.5×
- [x] 🤖 Open Test review → All → a task with a recorded run → the player shows a "Playback speed" control set to 1×
- [x] 🤖 Pick 0.5× → the video plays at half speed
- [x] 🤖 Reload the page → the control still reads 0.5× and the video plays at half speed
- [ ] Press Play at 0.5× → the motion is visibly slower and the playhead keeps in step with the video
- [ ] In Vietnamese the control is labelled "Tốc độ phát" and fits next to the time
### Regression risk
- [ ] Clicking a step, ←/→ and space still seek and play as before
