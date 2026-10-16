# T543: Spike: can one MCP connection know which project the agent is in?
**Status:** 📋 Todo
**Phase:** R104 — One agent connection
**Size:** S (~1 hr, time-boxed to 2 hrs)
**Depends on:** —
**Covers:** S1

## Goal
Decide, with evidence, how one agent connection tells VibeDoc which project folder the agent runs in. Go/no-go is written down before any build task starts.

## Context
- Epic: `plans/roadmap/R104-one-agent-connection.md`
- Problem: `/api/mcp` is hand-rolled request/response JSON-RPC over HTTP (CLAUDE.md: don't add the SDK stdio transport). HTTP doesn't carry the agent's cwd, and server-initiated `roots/list` needs a server→client stream we don't have.
- Candidates, in order:
  1. User-scope `claude mcp add --scope user --transport http vibedoc <hub>/api/mcp --header "X-VibeDoc-Root: ${PWD}"` — does Claude Code expand env vars in HTTP headers, and is `PWD` the project folder? (Check with Context7 / Claude Code docs, then try with a real `claude`.)
  2. MCP `initialize` params: does the client send `roots` or a workspace path?
  3. Fallback (known to work): per-project URL `…/api/mcp?root=<abs>` added at local scope for each hub project (R081 already runs `claude mcp add` at local scope). "Connect once" = VibeDoc does it for every project, and for each new one on add.

## Scope
- [ ] Try 1 and 2 against real Claude Code and Cursor; record exact config + result
- [ ] Write `docs/architecture/decisions/ADR-<next>-one-agent-connection.md` with the decision (go = 1 or 2, no-go = 3) via `vibedoc_log_decision` or by hand in the ADR format
- [ ] Update T544's Context with the chosen path (one line), nothing else

**Out of scope:** building it (T544).

## Files
- `docs/architecture/decisions/ADR-*-one-agent-connection.md` — new
- `plans/tasks/T544-connect-once-for-all-projects.md` — one Context line

## Acceptance criteria
- [ ] The ADR names the chosen mechanism, the evidence (commands + what VibeDoc received), and what breaks if the client changes
- [ ] If 1 or 2 wins: a curl/agent transcript shows two sessions in two folders sending two different roots

## Manual tests
- [ ] S1 — WHEN an agent connected once calls a tool from inside repo B → THEN the reply is about repo B, not the first project connected

## Verify
```bash
claude mcp list
# both sessions: ask the agent to call vibedoc_get_status and compare the project heading
