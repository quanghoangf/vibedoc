# T232: Port taken — reuse a running VibeDoc, else fall back and say how to reconnect
**Status:** 📋 Todo
**Phase:** R080 — Stable address & startup
**Size:** M (2–3 hrs)
**Depends on:** T231
**Covers:** S2

## Goal
When the project's saved port is busy, the user is never left guessing: if it's this project's VibeDoc already running, we say so and open it; if it's another program, VibeDoc starts elsewhere and tells them the MCP URL changed and the exact reconnect commands.

## Context
- Epic: `plans/roadmap/R080-stable-address-startup.md`
- Identity probe: `GET http://localhost:<port>/api/projects` returns a JSON array whose `[0].root` is the server's configured root (`discoverProjects` in `src/lib/core.ts` puts it first). Same root (compare `path.resolve`d) → it's this project's VibeDoc. No new endpoint.
- Decisions: same project already running → print "VibeDoc is already running for this project" + the T231 banner, open the browser, exit 0 (no second instance). Another program → first free port from saved+1 upward, save it as the new address (the user reconnects once, then it's stable again), print the change. Explicit `--port N` taken by another program → exit 1 with "Port N is in use by another program" (the user pinned it; don't silently move).
- Reconnect text: `claude mcp remove vibedoc` then `claude mcp add --transport http vibedoc <new mcp url>` (`claude mcp add` refuses an existing name).

## Scope
- [ ] `bin/address.mjs`: `probeVibedoc(port, timeoutMs)` → `{ root } | null`; `addressChangedMessage({ oldPort, newPort })` → the lines
- [ ] `bin/vibedoc.mjs`: the three branches above
- [ ] `site/src/content/docs/docs/troubleshooting.md` "The agent can't reach VibeDoc": replace the "start with a fixed port" bullet with what VibeDoc now prints when the port changes, and the reconnect commands

**Out of scope:** waiting for readiness after spawn and start failures (T233); several projects on one address (epic out of scope).

## Files
- `bin/address.mjs`, `bin/address.check.mts`
- `bin/vibedoc.mjs`
- `site/src/content/docs/docs/troubleshooting.md`

## Implementation notes
- Probe with global `fetch` + `AbortSignal.timeout(1500)`; any error / non-JSON / non-array → null (another program).
- The browser open in the already-running branch reuses the same `open` import as the normal path.

## Acceptance criteria
- [ ] S2: with a plain `http.createServer` holding the saved port, `vibedoc` starts on another port, the terminal says the usual port is taken, shows the new MCP URL and both reconnect commands, and `.vibedoc/port` now holds the new port
- [ ] A second `vibedoc` in a project whose VibeDoc is running prints "already running" with the same URLs and exits 0 without starting a server
- [ ] `--port N` with N taken by another program exits 1 with a clear message
- [ ] `node bin/address.check.mts`: `probeVibedoc` against a stub returning `[{root}]`, a stub returning HTML, and a closed port; `addressChangedMessage` text

## Verify
```bash
node bin/address.check.mts
pnpm lint && pnpm build && pnpm --dir site build
```

## Manual tests
- [ ] S2 — WHEN the project's usual port is in use by another program → THEN VibeDoc starts on another port and the terminal says the MCP URL changed and how to reconnect
