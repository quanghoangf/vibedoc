# T543: Spike: can one MCP connection know which project the agent is in?
**Status:** ✅ Done
**Phase:** R104 — One agent connection
**Size:** S (~1 hr, time-boxed to 2 hrs)
**Depends on:** —
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-17
**Started:** 2026-10-16
**Done:** 2026-10-16

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
- [x] Try 1 and 2 against real Claude Code and Cursor; record exact config + result
- [x] Write `docs/architecture/decisions/ADR-<next>-one-agent-connection.md` with the decision (go = 1 or 2, no-go = 3) via `vibedoc_log_decision` or by hand in the ADR format
- [x] Update T544's Context with the chosen path (one line), nothing else

**Out of scope:** building it (T544).

## Files
- `docs/architecture/decisions/ADR-*-one-agent-connection.md` — new
- `plans/tasks/T544-connect-once-for-all-projects.md` — one Context line

## Acceptance criteria
- [x] The ADR names the chosen mechanism, the evidence (commands + what VibeDoc received), and what breaks if the client changes
- [x] If 1 or 2 wins: a curl/agent transcript shows two sessions in two folders sending two different roots

## Verify
```bash
claude mcp list
# both sessions: ask the agent to call vibedoc_get_status and compare the project heading

## Manual tests
_2026-10-16 — ai_
### Steps
- [ ] Read docs/architecture/decisions/ADR-006-one-agent-connection.md → it says Go (header `X-VibeDoc-Root: ${PWD}`) and has the command, the ~/.claude.json entry, a table of what the server received per folder, and the stale-PWD ceiling
- [ ] Open T544 → its Context has one "Decided (ADR-006)" line naming the header path and the resolution order
- [ ] Run `claude mcp list` → there is no `t543echo` server left over from the spike
- [ ] S1 — WHEN an agent connected once calls a tool from inside repo B → THEN the reply is about repo B, not the first project connected (proven with the echo server here; the real check is after T544 ships)
### Regression risk
- [ ] Existing per-project `?root=` connections: nothing changed in app code
