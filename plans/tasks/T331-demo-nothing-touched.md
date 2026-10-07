# T331: The demo touches nothing outside its temporary copy
**Status:** 👀 Review
**Phase:** R085 — Demo playground
**Size:** M (2–3 hrs)
**Depends on:** T330
**Covers:** S2
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
Whatever the user does in the demo, no file outside the temporary copy changes, and quitting (even a crash) leaves no demo folder behind. The demo also runs no live agents.

## Context
- Epic: `plans/roadmap/R085-demo-playground.md` — out of scope: "live agent runs inside the demo".
- T330 added `VIBEDOC_PLAYGROUND=1` (`isPlayground()` in `src/lib/demo.ts`), the root lock in `rootFrom()` / `discoverProjects()`, and the temp copy at `<tmp>/vibedoc-demo-XXXXXX/listly` with runs in `<tmp>/.runs`.
- Writes VibeDoc can make outside the project root, found in the code: spawning `claude -p` (`/api/chat`, which can then run tools anywhere), starting a frontend app and installing Playwright (`/api/frontend/*`), running specs (`/api/tasks/run`, `/api/suite/run`) which write the test kit into a frontend app and run its tests. Claude memory import only reads `~/.claude`; export writes AGENTS.md inside the root (fine).
- R042's read-only demo already guards these routes with `isDemo()` → `demoForbidden()` (pattern in `src/app/api/tasks/run/route.ts`). Playground keeps normal writes (tasks, docs, memory, roadmap, settings, views inside the copy) and blocks only the routes above.

## Scope
- [ ] `src/lib/demo.ts`: `playgroundForbidden()` (403 `{ error: 'Not available in the demo' }`) and use it in playground mode on `/api/chat`, `/api/frontend/**` routes that start / install, `/api/tasks/run` (+ cancel), `/api/suite/run` (+ cancel)
- [ ] UI in playground mode: saved chats stay readable, but the chat composer is replaced by one line ("The demo doesn't run agents. Use VibeDoc on your project to chat with your agent." + the T330 dialog button); Run / suite Run buttons are disabled with the same reason as a tooltip
- [ ] `bin/demo.mjs`: on start, delete leftover `vibedoc-demo-*` folders in `os.tmpdir()` older than 1 day whose `listly` copy has the demo marker (a crash or `kill -9` skips cleanup); only folders with that prefix and marker, never anything else
- [ ] Text in `src/i18n/` (en + vi)
- [ ] `e2e/demo-playground.mjs`: starts `node bin/vibedoc.mjs --demo --port 3085` itself (needs a prior `pnpm build`), finds the temp root from `/api/projects`, moves a task, edits a doc, ticks a manual test; checks the edit is in the temp copy; `POST /api/chat` and `POST /api/tasks/run` → 403; sends SIGINT; then asserts the temp folder is gone, `git status --porcelain examples/` is empty, and `~/.vibedoc/runs` has the same entries as before

**Out of scope:** sample data (T332, T333); the hosted read-only demo (unchanged).

## Files
- `src/lib/demo.ts` — `playgroundForbidden()`
- `src/app/api/chat/route.ts`, `src/app/api/frontend/**/route.ts` (start/install), `src/app/api/tasks/run/route.ts`, `src/app/api/tasks/run/cancel/route.ts`, `src/app/api/suite/run/route.ts`, `src/app/api/suite/run/cancel/route.ts` — playground guard
- the chat composer (`src/components/chat/…`, find the input in `ChatView`), Run buttons (`useTestRun` callers, `SuiteTab`) — disabled state
- `bin/demo.mjs` — leftover sweep (+ a case in `bin/demo.check.mts`)
- `e2e/demo-playground.mjs` — new
- `src/i18n/*.ts`

## Implementation notes
- Demo marker: T330's copy can write a small `.vibedoc-demo` file into the temp root on copy; the sweep checks it before deleting.
- The e2e needs Playwright like the other e2e files (`PW_DIR`, `launchChrome` from `e2e/stub-chat.mjs`), but most checks are plain `fetch` — use the browser only for the composer/disabled-button check.

## Acceptance criteria
- [ ] `e2e/demo-playground.mjs` passes on port 3085
- [ ] In the demo, the chat page shows saved chats and the "doesn't run agents" line; Run buttons are disabled with a reason
- [ ] Outside the demo, chat and Run work as before
- [ ] A leftover `vibedoc-demo-*` folder from yesterday with the marker is removed on the next `--demo` start; one without the marker is kept (check)
- [ ] `node bin/demo.check.mts`, `node src/lib/i18n.check.mts`, `pnpm lint`, `pnpm build` pass

## Manual tests
_2026-10-07 — ai · Auto: `e2e/demo-playground.mjs` passed 2026-10-07 (moves/edits/ticks land in the copy, chat + runs 403, composer replaced, Ctrl+C leaves no server, no temp folder, examples/ and ~/.vibedoc/runs unchanged)_
### Steps
- [ ] S2 — WHEN the user edits or moves things in the demo and quits → THEN no file outside VibeDoc's temporary demo copy has changed
- [ ] In the demo, open a task in review on the board → no Verify button and no Run button; Manual tests page has no Run / suite Run
- [ ] In the demo, click "Chat" on an epic sheet (or a chat suggestion) → a toast says the demo doesn't run agents; nothing spins
- [ ] In the demo, press Ctrl+C right after starting (before the browser opens) → the temp folder is removed and nothing listens on the port
### Regression risk
- [ ] `node bin/vibedoc.mjs` without `--demo`: chat sends, Run on a task with a spec runs, Ctrl+C stops the server (no `next-server` left in `ps`)

## Verify
```bash
node bin/demo.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with playwright> node e2e/demo-playground.mjs
```

## Notes
- Found while testing and fixed here (T330 is in review): the Demo banner was a row under the header, which pushed the bottom of the `100svh - 3rem` pages (chat composer, roadmap, graph, test review) off screen. It now sits in the header (badge + "Use VibeDoc on my project"; the note is the badge tooltip and in the dialog). T330's spec follows it.
- The CLI left `next-server` running after Ctrl+C (`server.kill` reached only `npx`), and its signal handlers were only registered after the 2.5 s wait. It now spawns Next in its own process group, kills the group, and registers handlers right after spawning. R080 is rewriting startup: keep `stop()` and the early handlers when merging. Also added `--no-open` for the e2e.
- Run controls and Verify are hidden in the demo (as in R042's read-only demo) instead of disabled-with-tooltip: one rule for both demos, and the toast covers every Ask/Verify/Generate path through `askAgent()` / `send()`.
