# T544: Connect once for all projects
**Status:** 📋 Todo
**Phase:** R104 — One agent connection
**Size:** M (2–3 hrs)
**Depends on:** T543, T535
**Covers:** S1

## Goal
After one Connect on Settings → Connect agent, a Claude Code session in any hub project talks to its own project, and projects added later are connected without another click.

## Context
- Epic: `plans/roadmap/R104-one-agent-connection.md`
- Chosen mechanism: **set by T543's ADR** (read it first). Do not build before it exists.
  - Go (header / initialize carries the folder): `/api/mcp` resolves the root from that value through the hub (`projectFor` in `src/lib/hub.ts`, nearest hub root that contains the folder, so a sub-folder works); the Connect panel runs one user-scope `claude mcp add`.
  - No-go (fallback): "Connect all projects" runs the local-scope `claude mcp add … ?root=<abs>` (`src/lib/claude-cli.ts`, cwd = that root) for every hub project without one, and `addHubProject` does it for new projects after the user turned "Connect new projects automatically" on (stored in `hub.json`, it acts outside the project so it needs the user's yes, like R081).
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

## Manual tests
- [ ] S1 — WHEN an agent connected once calls a tool from inside repo B → THEN the reply is about repo B, not the first project connected

## Verify
```bash
node src/lib/agent-connect.check.mts && node src/lib/claude-cli.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH BASE=http://localhost:3081 node e2e/connect-agent.mjs
```
