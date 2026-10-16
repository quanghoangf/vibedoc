# ADR-006: One agent connection finds its project from an `X-VibeDoc-Root: ${PWD}` header

**Status:** ✅ Accepted
**Date:** 2026-10-16

## Context
R104 wants one Claude Code connection for every hub project: a session started in repo B must get answers about repo B. `/api/mcp` is hand-rolled request/response JSON-RPC over HTTP (ADR-004), so a request carries no working folder unless the client puts one in. Spike T543 tested three candidates against real Claude Code 2.1.301 on macOS, with an echo MCP server on port 3102 that logs every request's headers and body. Each session ran from a different temp folder: `claude -p "Call the mcp__t543echo__whoami tool once…" --allowedTools mcp__t543echo__whoami`. The test server was named `t543echo`, never `vibedoc`, and it was removed after the spike.

### Candidate 1: a user-scope header that expands `${PWD}` — works
```bash
claude mcp add --scope user --transport http t543echo http://localhost:3102/mcp --header 'X-VibeDoc-Root: ${PWD}'
```
The entry in `~/.claude.json` keeps the template as written: `{"type": "http", "url": "http://localhost:3102/mcp", "headers": {"X-VibeDoc-Root": "${PWD}"}}`. Claude Code expands it from its own environment at connect time. It then sends the header on every request: `server/discover`, `initialize`, `notifications/initialized`, the GET stream, `tools/list` and `tools/call`.

| Session started in | `X-VibeDoc-Root` the server received |
|---|---|
| `…/scratchpad/repoA` | `…/scratchpad/repoA` |
| `…/scratchpad/repoB` | `…/scratchpad/repoB` |
| `…/scratchpad/repoA/sub` | `…/scratchpad/repoA/sub` (the agent's folder, not the project root) |
| `repoB` with `PWD` unset (`env -u PWD claude …`) | the literal text `${PWD}` |
| `repoB` with a stale `PWD=…/repoA` | `…/repoA`: a valid path to the **wrong** project |

Control: the same session with `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` sent nothing.

### Candidate 2: the `initialize` params — the folder is not there, but `roots/list` works
The full `initialize` params are `{"protocolVersion":"2025-11-25","capabilities":{"roots":{"listChanged":true},"elicitation":{"form":{},"url":{}}},"clientInfo":{"name":"claude-code",…,"version":"2.1.301"}}`. They have no folder and no roots. But Claude Code supports roots, and after `initialize` it opens a GET stream. When the echo server answered that GET with `text/event-stream` and pushed `{"jsonrpc":"2.0","id":"roots-1","method":"roots/list"}`, Claude Code POSTed back the real working folder. This held even with a stale or unset `PWD`:
- From `repoB` with `PWD=…/repoA`: `{"result":{"roots":[{"uri":"file:///…/scratchpad/repoB"}]},"id":"roots-1"}`
- From `repoA/sub` with `PWD` unset: `{"result":{"roots":[{"uri":"file:///…/scratchpad/repoA/sub"}]},"id":"roots-1"}`

The reply came after `tools/list` and before `tools/call`. Matching a reply to a later tool call needs MCP session ids (`Mcp-Session-Id` from `initialize`, held per session). The echo server did not issue one, so that part is **untested**.

### Also tried: `headersHelper`
For a user-scope server, the helper script runs with its cwd set to `~/.claude` and its `PWD` set to `~/.claude`. It gets no project folder variable. `CLAUDE_PID` points to the outermost Claude when sessions are nested. A helper that reads its parent process's cwd (`lsof -a -p $PPID -d cwd`) gave the right folder, but it needs a shipped script, `lsof` and a walk up the process tree. That does not work on Windows. Rejected.

### Cursor (docs only, not run)
There is no `~/.cursor/mcp.json` or `cursor-agent` on this machine. In Cursor's docs, `${workspaceFolder}` means "the folder that contains `.cursor/mcp.json`", so a global config cannot carry the project. Cursor keeps the per-project paste (`?root=`).

## Decision
**Go with candidate 1.** Settings → Connect agent runs one user-scope command:

```bash
claude mcp add --scope user --transport http vibedoc <hub>/api/mcp --header 'X-VibeDoc-Root: ${PWD}'
```

`/api/mcp` resolves the root in this order:
1. **`?root=`**, when present. Existing local-scope connections keep working and are more specific than the user-scope server.
2. **`X-VibeDoc-Root`**, only when it is an absolute path with no `${`. The server realpaths it (the log shows `/private/tmp/…` where hub.json may store `/tmp/…`) and maps it to the nearest hub project that contains it (`projectFor`). The agent's folder can be a sub-folder.
3. **Otherwise, refuse.** A tool call gets an error that lists the hub projects and the per-project connect command. It never falls back silently to the first project.

## Rationale
The header path is the smallest change: one header read in the request/response route and no new transport. In a terminal, `PWD` is the folder the user typed `claude` in, which is the normal case. The refuse rule makes an unset `PWD` (the literal `${PWD}`) harmless.

## Alternatives considered
| Option | Why rejected (for now) |
|--------|-------------|
| Candidate 2: `roots/list` over the GET event stream | It returned the correct folder in every case, stale `PWD` included. But `/api/mcp` would need a held GET stream, `Mcp-Session-Id`, a session → root map and a wait in `tools/call` until the roots reply arrives. That is more than T544 needs today. It is the proven upgrade path (see Consequences). |
| `headersHelper` with the parent process's cwd | It works, but it needs a shipped script, `lsof` and a process-tree walk, so not Windows. The helper's own cwd is `~/.claude`. |
| Fallback: a local-scope `claude mcp add … ?root=<abs>` for each hub project | Known to work and stays honoured. "Connect once" would then mean N commands, plus one more for each project added later. |

## Consequences
- **Ceiling: a stale `PWD`.** When Claude Code is spawned with `cwd` set but an inherited `PWD` (an IDE extension or a GUI launcher), the header carries the launcher's folder. If that folder is a hub project, the server answers about the wrong project, and the server cannot detect this. Upgrade: the `roots/list` path above, or a local-scope `?root=` connection for that project (rule 1 wins).
- **If the client changes:** the server refuses rather than guesses in these cases: Claude Code stops expanding `${VAR}` in user-scope headers (the literal arrives), drops the header on some requests, or a client sends no header.
- Cursor and other clients keep the per-project `?root=` config.
- T544 builds rules 1–3 and the one-command Connect. Listing or acting on other projects stays out of scope (T545).
