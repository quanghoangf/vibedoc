# T150: Keep the last N runs per task
**Status:** ✅ Done
**Phase:** R059 — Screenshots & video capture
**Size:** S
**Depends on:** T149
**Owner:** ai:claude-code
**Due:** 2026-10-05
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
Run folders don't pile up on disk. After every run, only the newest N runs of that task are kept.

## Context
- Epic: `plans/roadmap/R059-screenshots-video-capture.md`
- Run dirs and `runId` come from T138 (`src/lib/runs-paths.ts`). runIds sort lexically by time.
- N defaults to **5**. It can be overridden per project in the project settings VibeDoc already keeps (find where custom statuses from T083 are stored and add a `runs.keep` key there). For the fixture process, env `VIBEDOC_RUNS_KEEP` takes precedence.

## Scope
- [ ] `src/lib/runs-retention.ts` (pure planner): `planPrune(runIds, keep)` returns the ids to delete (all but the newest `keep`). `keep < 1` is treated as 1
- [ ] The fixture from T138 calls the pruner after writing `run.json` for the current run. Only that task's dir is touched
- [ ] Settings key `runs.keep` (number) is read by the app. The fixture reads `VIBEDOC_RUNS_KEEP`, falling back to 5
- [ ] Self-check `src/lib/runs-retention.check.mts`

**Out of scope:** a settings UI for N (edit the settings file or the env var), and a global size cap.

## Files
- `src/lib/runs-retention.ts` + `runs-retention.check.mts`: new
- `src/testing/playwright-fixture.ts`: call the prune step at teardown
- The project settings type/reader: the `runs.keep` key

## Implementation notes
- Never delete the run that is being written. Prune after `run.json` exists, and exclude the current runId explicitly.
- Use `fs.rm(dir, { recursive: true, force: true })`. If a delete fails (e.g. the video is locked on Windows), log it and continue. A failed delete must never fail the test.

## Acceptance criteria
- [ ] With keep=2, running the demo spec 4 times leaves exactly the 2 newest run dirs for that task
- [ ] Other tasks' run dirs are untouched
- [ ] keep=0 or garbage behaves as 1. When unset, the default is 5
- [ ] Self-check covers ordering, keep bounds and the empty list

## Verify
```bash
node src/lib/runs-retention.check.mts
pnpm build && pnpm lint
export VIBEDOC_RUNS_DIR=$(mktemp -d) VIBEDOC_TASK_ID=T139 VIBEDOC_RUNS_KEEP=2
for i in 1 2 3 4; do npx playwright test e2e/fixtures/capture-demo.spec.ts; done
ls $VIBEDOC_RUNS_DIR/*/T139   # 2 dirs
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [x] With VIBEDOC_RUNS_KEEP=3, run a checklist spec 5 times for one task. Open `~/.vibedoc/runs/<project>/<task>/` and confirm that only the 3 newest timestamped folders remain, and that each one still has its screenshots, video.webm and run.json.
- [x] Put `{"runs":{"keep":2}}` in the target project's `.vibedoc/settings.json`, leave VIBEDOC_RUNS_KEEP unset, then run a spec 3 times. 2 runs remain. Then set VIBEDOC_RUNS_KEEP=4 and confirm that the env var takes precedence over the setting.
- [x] Run specs for two different task ids (for example T139 and T140) with a low keep. Pruning one task never removes folders of the other task.
- [x] Make the demo spec fail (CAPTURE_DEMO_FAIL=1) with keep=1. The failed run is the one kept, it has its failure screenshot and run.json with status "failed", and older runs are gone.
- [x] Run several tests of one task in parallel workers (e.g. --workers=4 --repeat-each=4) with VIBEDOC_RUNS_KEEP=1. No test fails with ENOENT: a run dir without run.json (still being written) is never pruned.
### Regression risk
- [x] Put a non-run folder (for example `notes/`) or a file inside a task's runs dir. Pruning leaves it alone, because only names in the `YYYYMMDDTHHMMSSZ` format are candidates.
- [x] Make an old run folder undeletable (`chmod 500` on the task dir, then reset it). The test still passes, and a "vibedoc: could not delete old run" warning is printed instead of an error.
- [x] Tasks still load on /board after the `runs.keep` key is added to `.vibedoc/settings.json` (readProjectSettings now also returns runsKeep). Custom statuses and auto due dates still behave as before.
