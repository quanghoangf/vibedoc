# T152: Runs section in the task panel + e2e + docs
**Status:** ✅ Done
**Phase:** R059 — Screenshots & video capture
**Size:** M
**Depends on:** T150, T151
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
Opening a task shows its latest run: one thumbnail per checklist step with pass/fail, and a playable video. A human sees the feature working without running anything. This meets the epic's "Done when".

## Context
- Epic: `plans/roadmap/R059-screenshots-video-capture.md`
- Data comes from T140 (`/api/tasks/[id]/runs`, plus the media route).
- Keep the viewer minimal. The full evidence doc (steps, expected results, history) is R060. Don't build a run-history browser here, only the latest run plus a run picker dropdown.
- Mount it in the unified item panel from T084, next to the Manual tests / Sessions sections (copy how T048 added "Sessions").

## Scope
- [ ] `TaskRuns` component: a header with the run time, a status badge and an `x/y steps passed` count, plus a `<select>` of the kept runs
- [ ] A grid of step thumbnails (name + ✓/✗). Click opens the full image in the existing dialog/sheet pattern
- [ ] `<video controls preload="metadata">` for `video.webm`
- [ ] Empty state: "No recorded runs yet", with a one-line hint to use `vibedoc/playwright`
- [ ] Docs: a short section in the README / getting-started page on the fixture (`step()`, env vars, where files go, `runs.keep`)
- [ ] e2e script `e2e/task-runs.mjs`: seed a run dir under a temp `VIBEDOC_RUNS_DIR` (2 PNGs + a small webm + run.json), open the task, then assert the thumbnails, the step names and the video element with a non-zero duration

**Out of scope:** the evidence markdown doc and run history (R060), comparing screenshots, and a run-tests button (R061).

## Files
- `src/components/…/TaskRuns.tsx`: new
- The item panel component from T084: mount the section for tasks
- `e2e/task-runs.mjs`: new, following the `PW_DIR` pattern of `e2e/memory-browser.mjs`
- `README.md` and the getting-started page from T134: a fixture section

## Acceptance criteria
- [ ] A task with a run shows every step's screenshot named after the checklist item, and the video plays and seeks
- [ ] A failed step shows ✗ and its error text on hover/click
- [ ] Switching the run in the select swaps the thumbnails and video
- [ ] A task without runs shows the empty state, and the panel layout is unchanged otherwise
- [ ] Works in dark and light themes and at a 390px width

## Verify
```bash
pnpm build && pnpm lint
PW_DIR=<dir with playwright> BASE=http://localhost:3000 node e2e/task-runs.mjs   # ok lines, exit 0
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Seed or record a run for a task. Open the task panel from /board. A **Runs** section shows above Review/Sessions with a status badge, a relative time, `x/y steps passed` and one thumbnail per step with ✓ or ✗.
- [ ] Hover a failed thumbnail. The tooltip shows the step name and the error. Click it. The dialog shows the full screenshot and the error text in red. Press Escape. Only the dialog closes and the task panel stays open.
- [ ] Play the video in the Runs section and drag the seek bar. Playback and seeking work.
- [ ] With two or more kept runs, pick an older run in the select. The badge, the count, the thumbnails and the video all change to that run.
- [ ] Open a task without runs. "No recorded runs yet …" shows with the `vibedoc/playwright` / `step()` hint, and the rest of the panel looks the same as before.
- [ ] Switch to the light theme and resize to 390px. The badge, the select and the thumbnail grid (2 columns) are readable and nothing overflows sideways.
- [ ] Open /getting-started. The new "6. Screenshots and video" section renders, and the README link `#6-screenshots-and-video` lands on it.
### Regression risk
- [ ] In the task panel, Escape with no image dialog open still closes the panel, and the ⋯ menu's Escape still closes only the menu (the new window capture listener exists only while the image viewer is open).
- [ ] The Manual tests link, the auto-tests line, Review history and Sessions still render in the same order under the panel body.
### Verified automatically
- [ ] `pnpm build` exit 0; `pnpm lint` 17 problems = baseline, 0 in changed files.
- [ ] `e2e/task-runs.mjs` exit 0, 6 ok lines (thumbnails + names, failed ✗ + error on hover/dialog, Escape keeps panel, video 2.52s + seek, run picker swaps media, 390px no sideways scroll + empty state, no console errors). Light theme not checked automatically (only existing theme tokens used). The e2e seeds under the server's runs root (`$VIBEDOC_RUNS_DIR` or `~/.vibedoc/runs`) in a unique fixture project folder, removed in `finally`, because the :3000 server can't be restarted with a temp root.
