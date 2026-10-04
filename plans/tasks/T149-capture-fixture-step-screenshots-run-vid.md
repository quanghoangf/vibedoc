# T149: Capture fixture: step screenshots + run video + run.json
**Status:** ✅ Done
**Phase:** R059 — Screenshots & video capture
**Size:** L
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-11
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
A Playwright fixture that VibeDoc ships and R058 specs import. Wrapping each checklist item in `step(name, fn)` saves a screenshot named after the item. The whole run is recorded as a video, and a `run.json` manifest is written, all under `~/.vibedoc/runs/`. This is the thin end-to-end path the rest of R059 reads from.

## Context
- Epic: `plans/roadmap/R059-screenshots-video-capture.md`
- Decided: R059 ships a **shared fixture** that R058 specs import. It does not extend R058's runner, so this task does not wait for R058.
- Decided: artifacts go to `~/.vibedoc/runs/<project>/<taskId>/<runId>/`, outside the repo, so no `.gitignore` change is needed.
- The fixture runs inside the target FE repo's Playwright process, not inside the VibeDoc server. The CLAUDE.md rule "only `src/lib/core.ts` touches fs" applies to the app. The fixture is a separate entry point and may write its own files.
- Out of scope for the epic: cloud upload, sharing links, and annotating media.

## Scope
- [ ] New fixture module that exports `test` (extends `@playwright/test`'s `test`) and `expect`
- [ ] `step(name, fn)` runs `test.step(name, fn)`, then takes a full-page screenshot as `NN-<slug(name)>.png`. The screenshot is taken on failure too, and then the error is re-thrown
- [ ] Video: turn on `recordVideo` for the fixture's context. On teardown, move the `.webm` file into the run dir as `video.webm`
- [ ] Write `run.json` in the run dir when the test ends (shape below)
- [ ] Export it from the package as `vibedoc/playwright` (add an `exports` entry in package.json). Keep `@playwright/test` as a peer dependency, not a dependency
- [ ] `src/lib/runs-paths.ts` (pure): `runsRoot()`, `projectKey(root)`, `runDir(project, taskId, runId)`, `newRunId(date)`. Shared by the fixture and core

**Out of scope:** pruning old runs (T139), the API and the viewer (T140, T141), and generating specs from checklists (R058).

## Files
- `src/testing/playwright-fixture.ts`: new. The fixture and `step()`
- `src/lib/runs-paths.ts`: new, pure path helpers
- `package.json`: the `exports` entry `./playwright`, plus the peer dependency
- `e2e/fixtures/capture-demo.spec.ts`: new. A tiny spec with 2 steps against any page, used to verify this task

## Implementation notes
- Inputs: `taskId` comes from the fixture option `vibedocTask` (`test.use({ vibedocTask: 'T138' })`), falling back to env `VIBEDOC_TASK_ID`. The project comes from env `VIBEDOC_PROJECT`, falling back to the basename of `VIBEDOC_ROOT` or of cwd. `projectKey` slugifies it.
- `runsRoot()` = `$VIBEDOC_RUNS_DIR` or `~/.vibedoc/runs`. The env override lets tests use a temp dir.
- `runId` = a compact UTC timestamp (`20261004T101500Z`) that sorts lexically, so pruning can sort by name.
- The video is only finalized after `page.close()` or `context.close()`. Get it with `await page.video()?.path()` after closing, then move it.
- `run.json` shape (T139–T141 and R060 read it, so keep it stable):
```json
{ "runId": "20261004T101500Z", "taskId": "T138", "project": "vibedoc",
  "startedAt": "…", "endedAt": "…", "status": "passed|failed", "commit": "<git sha or null>",
  "video": "video.webm",
  "steps": [{ "index": 1, "name": "Open /board → board loads", "status": "passed", "screenshot": "01-open-board-board-loads.png", "error": null }] }
```
- Slugs: lowercase, non-alphanumerics become `-`, at most 60 chars, prefixed with a 2-digit index so names stay unique and ordered.

## Acceptance criteria
- [ ] Running the demo spec makes one run dir with `01-…png`, `02-…png`, `video.webm` and `run.json`
- [ ] A failing step still writes its screenshot, `run.json` has `status: failed` and the error message, and the test itself fails
- [ ] Nothing is written inside the project repo (`git status` stays clean)
- [ ] `VIBEDOC_RUNS_DIR` redirects all output
- [ ] Self-check `node src/lib/runs-paths.check.mts` covers slugging, runId ordering and the env override

## Verify
```bash
node src/lib/runs-paths.check.mts
pnpm build && pnpm lint
VIBEDOC_RUNS_DIR=$(mktemp -d) VIBEDOC_TASK_ID=T138 npx playwright test e2e/fixtures/capture-demo.spec.ts
ls -R $VIBEDOC_RUNS_DIR   # <project>/T138/<runId>/{01-*.png,02-*.png,video.webm,run.json}
git status   # clean
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Run `CAPTURE_DEMO_FAIL=1 VIBEDOC_RUNS_DIR=$(mktemp -d) VIBEDOC_TASK_ID=T138 npx playwright test e2e/fixtures/capture-demo.spec.ts`, then open `02-*.png`: it shows the button reading "Clicked" (page state at the failure), and run.json step 2 has a readable error with no escape codes.
- [ ] Open `video.webm` from a passing run in a browser or QuickTime/VLC: it plays and shows the heading and the button click.
- [ ] Run the demo without `VIBEDOC_RUNS_DIR` or `VIBEDOC_TASK_ID`, with `VIBEDOC_PROJECT="My App"`: output lands in `~/.vibedoc/runs/my-app/no-task/<runId>/`. Delete that folder afterwards.
- [ ] Add `test.use({ vibedocTask: 'T200' })` to a copy of the demo spec and run it with `VIBEDOC_TASK_ID=T138`: the run dir is under `T200` (the option wins over the env var).
- [ ] Run the demo with `--repeat-each 2`: two run dirs with consecutive runIds, neither overwrites the other.
- [ ] `npm run build:playwright`, then `npm pack --dry-run`: the tarball lists `dist/testing/playwright-fixture.{js,d.ts}` and `dist/lib/runs-paths.{js,d.ts}`. In a scratch project with that tarball installed, `import { test } from 'vibedoc/playwright'` runs the demo (agent checked with a copied node_modules/vibedoc: 1 passed, full run dir).
### Regression risk
- [ ] package.json now has an `exports` map: `node bin/vibedoc.mjs --version` still prints the version (agent checked: 1.12.0).
- [ ] `pnpm install` on a clean checkout shows no peer-dependency warning for @playwright/test, and `pnpm dev` still starts.
- [ ] `git status` after a Playwright run or `build:playwright` shows no `test-results/` or `dist/` (both gitignored).
- [ ] `prepublishOnly` now also runs `build:playwright`: a release build still publishes.
