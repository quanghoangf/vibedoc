# T251: One-click Claude Code MCP connect with confirm
**Status:** 👀 Review
**Phase:** R081 — Connect your agent
**Size:** M (2–3 hrs)
**Depends on:** T250
**Covers:** S1
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
The MCP step gets a Connect button for Claude Code: after the user confirms the exact command, VibeDoc runs it and says what changed. A failure shows Claude's real error and the fix, and the copy-the-command fallback stays.

## Context
- Epic: `plans/roadmap/R081-connect-your-agent.md` (spec change: "Guided connection" → "Confirm first": nothing changes outside VibeDoc until the user confirms, and the result names what changed).
- Decisions from the breakdown:
  - Command: `claude mcp add --transport http vibedoc <mcp-url>` with `cwd: root` and the default `--scope local`. Local scope is keyed to the cwd's project in `~/.claude.json`, so a wrong cwd silently registers it for another repo. Not `--scope project` (writes `.mcp.json` into the repo and shows as ⏸ pending approval).
  - Observed CLI output (Claude Code 2.1.292): success → exit 0, stdout `Added HTTP MCP server vibedoc with URL: <url> to local config` + `File modified: /Users/…/.claude.json [project: <root>]`; existing name → exit 1, `MCP server vibedoc already exists in local config`. Show the success stdout as "what changed".
  - "Already exists" → show that message and offer **Replace** (second confirm) = `claude mcp remove vibedoc -s local` then add. Never remove without that confirm.
  - Process calls live in a process-only lib `src/lib/claude-cli.ts` (the `src/lib/frontend-server.ts` pattern): `execFile('claude', [...fixed argv])`, no shell, timeout (config constant, e.g. 30s). Never in core.ts.
  - Errors: `ENOENT` → "Claude Code isn't installed or not on PATH" + the command to copy; other non-zero exit → stderr verbatim + the command to copy.
- Trust boundary: `POST /api/agent-connect` runs a command on the user's machine. Refuse when `isDemo()` (as `/api/mcp` does), refuse cross-site requests (`Origin` host ≠ request host, or `Sec-Fetch-Site` not `same-origin`/`none` → 403), validate the URL is `http:`/`https:` before it reaches argv.
- `emitUpdate("agent_connect", …)` after a run that changed config (CLAUDE.md: always emit after a mutation).
- CLAUDE.md: add to the "No database" list that, only when the user confirms Connect, VibeDoc runs `claude mcp add/remove` (writes Claude Code's own config, not the project).

## Scope
- [ ] `src/lib/claude-cli.ts`: `mcpAdd(root, url)`, `mcpRemove(root)` → `{ ok, stdout, stderr, code, missing }`
- [ ] `POST /api/agent-connect { step: "mcp", url, replace? }` with the guards above
- [ ] Panel: agent picker stub ("Claude Code" only for now; T253 adds others), Connect → confirm dialog showing the exact command and "this edits Claude Code's settings for <root>" → result line; Replace flow; error + fix + Copy
- [ ] i18n (`en` + `vi`); e2e: stub `claude` script on `PATH` (records argv to a file, prints the observed outputs; a mode that exits 1 with "already exists")

**Out of scope:** skills install (T252), Cursor/Other (T253), installing Claude Code itself.

## Files
- `src/lib/claude-cli.ts` — new
- `src/app/api/agent-connect/route.ts` — add `POST`
- `src/components/connect/ConnectAgentPanel.tsx`
- `src/i18n/settings.ts`, `CLAUDE.md`, `e2e/connect-agent.mjs`, `e2e/fixtures/claude-stub/claude` (new, executable)

## Implementation notes
- Confirm dialog: reuse the app's dialog component used by `DocPathDialog` / `SpecMergeDialog`.
- e2e: start the server with `PATH=<repo>/e2e/fixtures/claude-stub:$PATH PORT=3081`; the stub reads a mode from a file in the fixture so one server run covers success and "already exists".

## Acceptance criteria
- [ ] Clicking Connect shows the command and changes nothing until Confirm (stub argv log stays empty)
- [ ] Confirm runs `claude mcp add --transport http vibedoc <url>` in the project root and the step shows the "Added … File modified …" result
- [ ] "Already exists" shows the CLI message and Replace; Replace (after its confirm) runs remove then add
- [ ] No `claude` on PATH → "not installed / not on PATH" + copyable command
- [ ] A POST with a foreign `Origin` → 403; in demo mode → refused
- [ ] e2e covers the four points above

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH PORT=3081 pnpm dev:next &
BASE=http://localhost:3081 node e2e/connect-agent.mjs
```

## Manual tests
_2026-10-07 — ai:claude-code_
### Steps
- [ ] S1 — WHEN the user clicks Connect for Claude Code and confirms → THEN VibeDoc is added to Claude Code's MCP servers and the step says what was changed
- [ ] Settings → Connect agent → click "Connect Claude Code" → a dialog shows the exact `claude mcp add …` command and the project folder; Cancel closes it and `claude mcp list` (in the project) shows no change
- [ ] Click again → Run it → the step shows "Done. Claude Code says:" with "Added HTTP MCP server vibedoc … File modified: ~/.claude.json [project: …]"; `claude mcp list` in the project now lists vibedoc with this URL
- [ ] Click Connect again → Run it → "already exists" message + Replace…; Replace… → a second dialog with remove + add; Replace it → the result shows "Removed …" then "Added …"
- [ ] With `claude` not on PATH (start VibeDoc with a PATH without it) → Connect → "Claude Code isn't installed or isn't on PATH" and the command to copy is still there
### Regression risk
- [ ] An already-connected Claude Code session keeps working after Replace with the same URL (restart Claude Code, call vibedoc_get_status)

Automated: `e2e/connect-agent.mjs` (confirm-first, Cancel runs nothing, add result shown, already exists → Replace → remove + add, cross-site POST 403) and `node src/lib/claude-cli.check.mts` (ENOENT → missing, add / already exists / remove argv against the stub) passed against `next dev -p 3081` with `e2e/fixtures/claude-stub` on PATH.

## Notes
- No agent picker yet (T253 adds it); the Connect button is Claude Code's.
- Demo-mode refusal is the same `isDemo()` guard as other mutating routes; not covered by the e2e.
