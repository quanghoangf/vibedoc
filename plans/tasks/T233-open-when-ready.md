# T233: Open the browser only when the app answers; clear start failures
**Status:** ✅ Done
**Phase:** R080 — Stable address & startup
**Size:** M (2–3 hrs)
**Depends on:** T232
**Covers:** S3
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Done:** 2026-10-07

## Goal
The browser opens on a page that loads the first time, and when the app can't start the terminal says why, no tab opens and the exit code is non-zero.

## Context
- Epic: `plans/roadmap/R080-stable-address-startup.md` (spec change `cli-startup` → "Open when ready", scenario "Start failure")
- Today `bin/vibedoc.mjs` waits a fixed `setTimeout(2500)` and then opens `/setup` and prints "running" whether or not the server is up.
- Decisions: readiness = `GET /api/projects` returns 200 (same probe as T232, via `probeVibedoc`), polled every 250 ms, up to 60 s. Child exits first → print "VibeDoc could not start (exit code N)" plus the last stderr lines, exit with N (or 1), no browser. Timeout → kill the child, print why, exit 1. New flag `--no-open` (also `VIBEDOC_NO_OPEN=1`) skips the browser so scripts and e2e can run the real bin.
- Keep opening `/setup`: the page that opens on start is R082's scope (spec `first-run`), don't change it here. Put the path in one `START_PATH` constant so R082 has a seam.

## Scope
- [ ] `bin/address.mjs`: `waitUntilReady({ port, root, child, timeoutMs })` → `'ready' | { exit: code } | 'timeout'`
- [ ] `bin/vibedoc.mjs`: replace the fixed wait; print "✓ VibeDoc is ready" + the banner only after ready; `--no-open`; drop the `/setup` hardcode into `START_PATH`
- [ ] Child stderr is still shown live (keep `inherit` for stdout; tee stderr so the failure message can quote its tail)
- [ ] `docs/getting-started.md`: one line on `--no-open`

**Out of scope:** changing which page opens (R082); a background service (epic out of scope).

## Files
- `bin/address.mjs`, `bin/address.check.mts`
- `bin/vibedoc.mjs`
- `docs/getting-started.md`

## Implementation notes
- Without `.next/` (unbuilt checkout) `next start` exits with an error almost at once — a good real start-failure case to try by hand.
- Check: a stub `http.createServer` that starts answering `/api/projects` after ~500 ms → `'ready'`; a fake child (`spawn(process.execPath, ['-e', 'process.exit(3)'])`) → `{ exit: 3 }`.

## Acceptance criteria
- [ ] S3: the browser opens only after `/api/projects` answers; the first page load has no connection error
- [ ] Start failure: when the app can't start, the terminal shows why, no browser tab opens, exit code is non-zero
- [ ] `--no-open` starts and prints the banner without opening a browser
- [ ] `node bin/address.check.mts` covers ready / child-exit / timeout

## Verify
```bash
node bin/address.check.mts && node bin/vibedoc.check.mts
pnpm lint && pnpm build
pnpm build && node bin/vibedoc.mjs --port 3080 --no-open   # prints ready + banner; Ctrl+C
```

## Manual tests
_2026-10-07 — ai:claude-code_
### Steps
- [ ] S3 — WHEN the browser opens → THEN the page loads on the first try, with no connection error
- [ ] WHEN the app cannot start → THEN the terminal shows why and no browser tab opens
- [ ] Run `npx vibedoc` → "✓ VibeDoc is ready" and the URLs print, then the browser opens on /setup and loads at once
- [ ] Run `npx vibedoc --no-open` → the same output ends with "Open http://localhost:<port>/setup in your browser." and no tab opens
- [ ] In a checkout with no `.next` build, run `node bin/vibedoc.mjs` → "✗ VibeDoc could not start: the app exited with code 1" with Next's "Could not find a production build" line, exit code 1, no tab
### Regression risk
- [ ] Ctrl+C stops VibeDoc and the Next server (nothing left listening on the port)
