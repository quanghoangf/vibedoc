# T151: Runs API: list a task's runs and serve their media
**Status:** ✅ Done
**Phase:** R059 — Screenshots & video capture
**Size:** M
**Depends on:** T149
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
The VibeDoc server can list a task's recorded runs and stream their screenshots and video, so the UI (T141) and later the evidence doc (R060) can show them.

## Context
- Epic: `plans/roadmap/R059-screenshots-video-capture.md`
- Artifacts live in `~/.vibedoc/runs/<projectKey>/<taskId>/<runId>/` (T138). The `run.json` shape is defined in T138.
- CLAUDE.md: only `src/lib/core.ts` touches fs, so put the reads in core and keep routes thin.
- Use `projectKey(root)` from `src/lib/runs-paths.ts`, so the server and the fixture agree on the folder.

## Scope
- [ ] `core.ts`: `listRuns(taskId, root)` returns parsed `run.json` files, newest first, and skips folders whose `run.json` is missing or bad. `readRunFile(taskId, runId, file, root)` returns a stream plus size
- [ ] `GET /api/tasks/[id]/runs` returns `{ runs: Run[] }`
- [ ] `GET /api/tasks/[id]/runs/[runId]/[file]` serves `.png` (`image/png`) and `.webm` (`video/webm`) with HTTP Range support, so the video can seek
- [ ] Path safety: `runId` must match `^\d{8}T\d{6}Z$`, and `file` must match `^[\w.-]+\.(png|webm)$`. Any other value returns 400. Never join raw input into a path without these checks
- [ ] `listTasks()` (or the task detail) exposes `lastRun: { runId, status, steps, passed } | null`, so the card and panel can show it cheaply

**Out of scope:** the UI (T141), deleting runs from the UI, and live SSE on new runs (a refetch on panel open is enough).

## Files
- `src/lib/core.ts`: `listRuns`, `readRunFile`, plus `lastRun` on tasks
- `src/app/api/tasks/[id]/runs/route.ts`: new
- `src/app/api/tasks/[id]/runs/[runId]/[file]/route.ts`: new

## Implementation notes
- Range: parse `bytes=start-end` and reply `206` with `Content-Range`, `Accept-Ranges: bytes` and `Content-Length`. Without it, Safari/Chrome often won't seek a webm.
- Demo mode (T132) is read-only. GETs are fine there, but there will be no runs dir, so return `{ runs: [] }`.

## Acceptance criteria
- [ ] After the T138 demo run, `GET /api/tasks/T138/runs` lists it with its steps
- [ ] The PNG and the video load in the browser, and the video request with `Range: bytes=0-1` returns 206
- [ ] `../`, unknown extensions and bad runIds return 400
- [ ] A task without runs returns `{ runs: [] }` and `lastRun: null`

## Verify
```bash
pnpm build && pnpm lint
pnpm dev &
curl -s localhost:3000/api/tasks/T138/runs | jq '.runs[0].steps'
curl -sI -H 'Range: bytes=0-1' localhost:3000/api/tasks/T138/runs/<runId>/video.webm   # 206
curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/tasks/T138/runs/x/..%2Fetc   # 400
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [x] Open http://localhost:3000/api/tasks/T138/runs/<runId>/video.webm in Chrome and in Safari. The video plays, and dragging the scrubber to the middle jumps there without reloading from the start.
- [x] Open http://localhost:3000/api/tasks/T138/runs/<runId>/01-open-the-page-heading-shows.png in the browser. The screenshot of the "Capture demo" page shows.
- [x] Run the capture demo for T138 again (`VIBEDOC_TASK_ID=T138 npx playwright test e2e/fixtures/capture-demo.spec.ts`), then refetch /api/tasks/T138/runs. The new run is listed first, and `lastRun.runId` for T138 in /api/tasks is the new id.
- [x] Run the demo with `CAPTURE_DEMO_FAIL=1`. T138 lastRun shows `status: "failed"`, `steps: 2`, `passed: 1`.
- [x] Start a second instance with `VIBEDOC_DEMO=1 PORT=3101` and request /api/tasks/T138/runs. It returns `{ runs: [] }`, and every task lastRun is null.
### Regression risk
- [x] The /board page and the task panel still load quickly and look the same. listTasks now reads ~/.vibedoc/runs on every refresh, and Task has a new `lastRun` field.
- [x] The vibedoc/playwright fixture still compiles and records runs (`pnpm build:playwright`). The RunManifest/RunStep types moved to src/lib/runs-paths.ts, and the fixture now re-exports them.
