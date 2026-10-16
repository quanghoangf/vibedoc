# T535: Move from one VibeDoc per project, with a one-time notice
**Status:** 📋 Todo
**Phase:** R100 — Auto-detect current repo
**Size:** M (2–3 hrs)
**Depends on:** T534
**Covers:** S1, S2

## Goal
People who used one VibeDoc per project keep all their data and are told once, in the terminal, that their projects now share one address and how to update their agent connection.

## Context
- Epic: `plans/roadmap/R100-auto-detect-current-repo.md` — builds spec MODIFIED `Stable project address` (scenarios Restart, Second project)
- A repo with a `.vibedoc/port` from R080 is an old setup. Its data (tasks, memory, `.vibedoc/*`) is untouched; only the address changes.
- Notice (printed once per project, then `.vibedoc/port` is deleted so it never repeats): old URL → new URL, plus `claude mcp remove vibedoc` and the new `claude mcp add …?root=` (reuse `addressChangedMessage`'s layout).
- Existing Claude Code connections keyed to the old port stop working; Settings → Connect agent (R081) already offers one-click reconnect, so the notice links there too.

## Scope
- [ ] `bin/address.mjs`: `legacyPort(root)` + `migrationMessage({oldPort, port, root})` (+ check)
- [ ] `bin/vibedoc.mjs`: print it after the banner when a legacy port exists, then remove the file (CLI may delete its own legacy file; it's not core data)
- [ ] `src/lib/agent-connect.ts` / Connect panel: the MCP URL carries `?root=` for the active project
- [ ] CLAUDE.md: `.vibedoc/port` entry now says "legacy, removed on first hub start"; `docs/specs` untouched (human merges)

**Out of scope:** one connection for all projects (R104).

## Files
- `bin/address.mjs` (+ `address.check.mts`), `bin/vibedoc.mjs`
- `src/lib/agent-connect.ts` (+ check), `src/components/connect/ConnectAgentPanel.tsx`
- `CLAUDE.md`
- `e2e/stable-address.mjs`, `e2e/connect-agent.mjs`

## Acceptance criteria
- [ ] A fixture with `.vibedoc/port = 3340`: first run prints the notice with both commands, second run doesn't
- [ ] Second project started while the first is open: first project's MCP URL is unchanged (spec scenario Second project)
- [ ] Connect panel's command for project B contains `?root=<B>`
- [ ] `e2e/stable-address.mjs`, `e2e/connect-agent.mjs` pass

## Manual tests
- [ ] S1 — WHEN the user runs `npx vibedoc` in a repo the hub doesn't know → THEN the repo is added to All projects and its board opens
- [ ] S2 — WHEN VibeDoc is already running and the user runs `npx vibedoc` in another repo → THEN no second VibeDoc starts and the browser opens that repo in the running one

## Verify
```bash
node bin/address.check.mts && node src/lib/agent-connect.check.mts
pnpm lint && pnpm build
node e2e/stable-address.mjs
PATH=$PWD/e2e/fixtures/claude-stub:$PATH BASE=http://localhost:3081 node e2e/connect-agent.mjs
```
