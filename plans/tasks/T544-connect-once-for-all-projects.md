# T544: Connect once for all projects
**Status:** 👀 Review
**Phase:** R104 — One agent connection
**Size:** M (2–3 hrs)
**Depends on:** T543, T535
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16

## Goal
After one Connect on Settings → Connect agent, a Claude Code session in any hub project talks to its own project, and projects added later are connected without another click.

## Context
- Epic: `plans/roadmap/R104-one-agent-connection.md`
- Chosen mechanism: **set by T543's ADR** (read it first). Do not build before it exists.
  - Go (header / initialize carries the folder): `/api/mcp` resolves the root from that value through the hub (`projectFor` in `src/lib/hub.ts`, nearest hub root that contains the folder, so a sub-folder works); the Connect panel runs one user-scope `claude mcp add`.
  - No-go (fallback): "Connect all projects" runs the local-scope `claude mcp add … ?root=<abs>` (`src/lib/claude-cli.ts`, cwd = that root) for every hub project without one, and `addHubProject` does it for new projects after the user turned "Connect new projects automatically" on (stored in `hub.json`, it acts outside the project so it needs the user's yes, like R081).
- Decided (ADR-006, `docs/architecture/decisions/ADR-006-one-agent-connection.md`): **Go**. One user-scope `claude mcp add --scope user --transport http vibedoc <hub>/api/mcp --header 'X-VibeDoc-Root: ${PWD}'`. `/api/mcp` uses `?root=` first, then the header only when it is an absolute path with no `${`, realpathed and mapped by `projectFor`. Anything else is refused with the project list and is never defaulted. Stale `PWD` is the known ceiling. `roots/list` is the upgrade path.
- Existing per-project connections keep working either way (`?root=` stays honoured).
- Connect panel shows one row per project with ✓ evidence (`.vibedoc/agent-connection.json`, R081) for each.

## Scope
- [ ] `/api/mcp`: root resolution per the ADR
- [ ] `src/lib/agent-connect.ts` (+ check): the connect plan for all projects
- [ ] `ConnectAgentPanel`: "Connect all projects" + per-project status list; confirm dialog lists the exact commands
- [ ] Site doc: connect page explains the one connection
- [ ] i18n `src/i18n/connect.ts`

**Out of scope:** listing/acting on other projects from the agent (T545).

## Files
- `src/app/api/mcp/route.ts`, `src/lib/agent-connect.ts` (+ check), `src/lib/claude-cli.ts` (+ check)
- `src/components/connect/ConnectAgentPanel.tsx`, `src/app/api/agent-connect/route.ts`
- `src/i18n/connect.ts`, site connect doc
- `e2e/connect-agent.mjs` (fake CLI `e2e/fixtures/claude-stub/claude`)

## Acceptance criteria
- [ ] Two hub projects, one Connect: `vibedoc_get_status` from repo A's folder answers about A, from repo B about B (epic Done when)
- [ ] A project added after Connect is connected without opening Settings (fallback path) or needs nothing (go path)
- [ ] The confirm dialog lists every command before anything runs
- [ ] `e2e/connect-agent.mjs` and `node src/lib/claude-cli.check.mts` pass

## Verify
```bash
node src/lib/agent-connect.check.mts && node src/lib/claude-cli.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH BASE=http://localhost:3081 node e2e/connect-agent.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] S1 — WHEN an agent connected once calls a tool from inside repo B → THEN the reply is about repo B, not the first project connected (ran real Claude Code 2.1 `claude -p` with an inline vibedoc server carrying `X-VibeDoc-Root: ${PWD}`: from repoB → "## repoB — Project Status", from the worktree → "## mp-t544-connect — Project Status")
- [x] 🤖 MCP call with no ?root= and header = repo A / repo B / a sub-folder of B / B's realpath → answers about that project; ?root= wins over the header (e2e/connect-agent.mjs §9)
- [x] 🤖 Header `${PWD}` (unexpanded), a folder outside every project, or no header at all → isError reply listing every hub project with its own connect command; never defaulted (e2e §9)
- [x] 🤖 Settings → Connect agent → "Connect all projects" → dialog shows the exact user-scope command; nothing runs until Run it; then the fake CLI logged one `mcp add --scope user … --header X-VibeDoc-Root: ${PWD}` (e2e §9)
- [x] 🤖 The "One connection for every project" block lists each hub project with its own ✓ from its .vibedoc/agent-connection.json (e2e §9)
- [ ] Click "Connect all projects" against a real Claude Code install, then `claude mcp get vibedoc` shows user scope with the header kept as `${PWD}` → start `claude` in two hub repos and ask for vibedoc_get_status in each
### Regression risk
- [x] 🤖 Per-project Connect / Replace (local scope), skills install, Cursor/Other paste, phone width (e2e §1–8)
- [x] 🤖 T545 unknown ?root= folder reply + vibedoc_list_projects (e2e/mcp-projects.mjs)
- [ ] Any client configured with a bare /api/mcp URL (no ?root=, no header) now gets the project list instead of the configured root's answers
