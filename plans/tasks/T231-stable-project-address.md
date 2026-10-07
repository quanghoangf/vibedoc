# T231: Same address on every run + printed MCP URL and connect command
**Status:** ✅ Done
**Phase:** R080 — Stable address & startup
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Done:** 2026-10-07

## Goal
`vibedoc` in a project comes up at the same port every run and prints the app URL, the MCP URL and the one `claude mcp add` command, so an agent connected once stays connected.

## Context
- Epic: `plans/roadmap/R080-stable-address-startup.md` (spec change `cli-startup` → "Stable project address")
- The real CLI is `bin/vibedoc.mjs` (package.json `bin`). It picks a random port in 49152–65535 today (`findFreeRandomPort`), so the MCP URL changes on every run.
- Decisions: the project's port is saved in `.vibedoc/port` (just the number + newline) in the target project, not in `.vibedoc/settings.json` (Settings writes rewrite that file). First run: `--port N` if given, else the first free port from 3333 upward (3333 matches the docs and the AI install prompt), then saved. Later runs: the saved port. An explicit `--port N` is saved as the project's address.
- Pure logic goes in a new `bin/address.mjs` (plain JS: the bin ships without a build and Node 20.9 can't strip types) with `bin/address.check.mts` beside it, like `bin/vibedoc.check.mts`.
- R081 seam: pass the port to the Next child as `VIBEDOC_PORT` so the app can show its own MCP URL later. Don't build any UI for it.

## Scope
- [ ] `bin/address.mjs`: `readSavedPort(root)`, `savePort(root, port)`, `parsePortArg(args)` (`--port N`, validated 1–65535, error text on bad input), `startupBanner({ appUrl, mcpUrl })` → the lines below
- [ ] `bin/vibedoc.mjs`: use them; remove `findFreeRandomPort`; pass `VIBEDOC_PORT`
- [ ] Banner prints: project root, `App:  http://localhost:<port>`, `MCP:  http://localhost:<port>/api/mcp`, `Connect Claude Code: claude mcp add --transport http vibedoc http://localhost:<port>/api/mcp`
- [ ] Docs: README "prints its MCP URL" block (README:48–52: drop "a fixed port keeps the MCP URL stable", show `npx vibedoc` + the printed command), `docs/getting-started.md:14`, `site/src/content/docs/docs/index.md:19` (VibeDoc keeps the same port per project; `--port` still pins it)
- [ ] CLAUDE.md "VibeDoc writes only …" list: add `.vibedoc/port`

**Out of scope:** what happens when the saved port is taken (T232); waiting for readiness / start failure (T233); `bin/vibedoc.js` + `ws-server.js` (legacy path, unused by the `bin` entry); which page opens (R082); the in-app Connect panel (R081).

## Files
- `bin/address.mjs` — new, pure helpers above (fs only for the `.vibedoc/port` read/write)
- `bin/address.check.mts` — new self-check
- `bin/vibedoc.mjs` — wire it in
- `README.md`, `docs/getting-started.md`, `site/src/content/docs/docs/index.md`, `CLAUDE.md`

## Implementation notes
- "Free" check: a port is taken when either `net.connect(port, '127.0.0.1')` succeeds or `listen(port)` fails (on macOS a listen on `::` can succeed while something holds 127.0.0.1). Keep this in `address.mjs` as `isPortTaken(port)`; T232 reuses it.
- `mkdir -p .vibedoc` before writing; a write failure (read-only repo) logs one line and continues — the address just isn't remembered.
- `--version` must keep working before any of this runs (`bin/vibedoc.check.mts`).

## Acceptance criteria
- [ ] Two runs in the same project print the same App and MCP URL (S1); the second run reads `.vibedoc/port`
- [ ] `--port 4000` uses 4000 and saves it; `--port abc` exits non-zero with a clear message
- [ ] The banner shows the app URL, the MCP URL and the connect command
- [ ] `node bin/address.check.mts` covers: save/read round trip, missing/garbage file → null, `parsePortArg` valid/invalid, first-free-from-3333 skips a taken port (stub server)

## Verify
```bash
node bin/address.check.mts && node bin/vibedoc.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-07 — ai:claude-code_
### Steps
- [ ] S1 — WHEN the user runs `vibedoc` in a project, stops it and runs it again → THEN both runs serve the same URL and the MCP URL printed in the terminal is unchanged
- [ ] Run `npx vibedoc` in a project with no `.vibedoc/port` → the terminal shows App, MCP and the `claude mcp add` command on a port from 3333 up, and `.vibedoc/port` holds it
- [ ] Run `npx vibedoc --port 4000` → it serves on 4000, and the next plain `npx vibedoc` uses 4000 too
- [ ] Run `npx vibedoc --port abc` → it stops with "--port needs a number from 1 to 65535"
### Regression risk
- [ ] `npx vibedoc --version` still prints only the version
