# T234: Restart end-to-end check, close R080
**Status:** ✅ Done
**Phase:** R080 — Stable address & startup
**Size:** S (~1 hr)
**Depends on:** T233
**Covers:** S1, S2, S3
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Done:** 2026-10-07

## Goal
Prove the Done-when with the real bin: stop and restart in the same project, the MCP URL is unchanged and an MCP call works with no reconfiguration.

## Context
- Epic: `plans/roadmap/R080-stable-address-startup.md`
- Pattern: `e2e/session-episodes.mjs` starts its own server from the `.next` build in a mktemp fixture; do the same but spawn `bin/vibedoc.mjs --no-open` (T233).
- Use port 3080 for the run (other sessions use other ports).

## Scope
- [ ] `e2e/stable-address.mjs`: temp project → run 1 with `--port 3080 --no-open`, read the printed MCP URL, POST `tools/list` to it → stop → run 2 with no `--port` → same printed MCP URL, `tools/list` works again (S1 + Done-when) → hold 3080 with a stub server → run 3 prints the changed URL + reconnect (S2). The start-failure case stays in `bin/address.check.mts`
- [ ] `memory/MEMORY.md` Key conventions: one line (`.vibedoc/port`, `bin/address.mjs` + check, already-running reuse, `--no-open`, `START_PATH` seam for R082, `VIBEDOC_PORT` for R081)
- [ ] Set R080 `**Status:** done` once every task is done

**Out of scope:** `docs/specs/cli-startup.md` (the human merges the epic's spec changes).

## Files
- `e2e/stable-address.mjs` — new
- `memory/MEMORY.md`
- `plans/roadmap/R080-stable-address-startup.md` (status)

## Acceptance criteria
- [ ] Done when: after stop + restart in the same project, the printed MCP URL is the same and an MCP `tools/list` call to it succeeds with no reconfiguration
- [ ] The e2e removes its temp project and kills every child in `finally`

## Verify
```bash
pnpm lint && pnpm build
node bin/address.check.mts && node e2e/stable-address.mjs
```

## Manual tests
_2026-10-07 — ai:claude-code_
### Steps
- [ ] S1 — WHEN the user runs `vibedoc` in a project, stops it and runs it again → THEN both runs serve the same URL and the MCP URL printed in the terminal is unchanged
- [ ] S2 — WHEN the project's usual port is in use by another program → THEN VibeDoc starts on another port and the terminal says the MCP URL changed and how to reconnect
- [ ] S3 — WHEN the browser opens → THEN the page loads on the first try, with no connection error
- [ ] Connect Claude Code with the printed command, stop VibeDoc, start it again in the same project → `claude mcp list` shows `vibedoc` connected and a `/vibedoc:next` works without re-adding the server
### Regression risk
- [ ] `npx vibedoc --version` still prints only the version
