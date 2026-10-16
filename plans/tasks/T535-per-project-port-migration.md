# T535: Move from one VibeDoc per project, with a one-time notice
**Status:** 👀 Review
**Phase:** R100 — Auto-detect current repo
**Size:** M (2–3 hrs)
**Depends on:** T534
**Covers:** S1, S2
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16

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

## Verify
```bash
node bin/address.check.mts && node src/lib/agent-connect.check.mts
pnpm lint && pnpm build
node e2e/stable-address.mjs
PATH=$PWD/e2e/fixtures/claude-stub:$PATH BASE=http://localhost:3081 node e2e/connect-agent.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] S1 — WHEN the user runs `npx vibedoc` in a repo the hub doesn't know → THEN the repo is added to All projects and its board opens
- [x] S2 — WHEN VibeDoc is already running and the user runs `npx vibedoc` in another repo → THEN no second VibeDoc starts and the browser opens that repo in the running one
- [x] A repo with `.vibedoc/port` = 3340 (`e2e/stable-address.mjs`): first run prints "Old MCP URL …:3340/api/mcp", the new `?root=` URL, `claude mcp remove vibedoc` + the new `claude mcp add`, and the Settings → Connect agent link; the file is gone, `.vibedoc/settings.json` stays; the second run prints no notice
- [x] Settings → Connect agent on project B (`e2e/connect-agent.mjs`) → the command, Cursor config and "just the URL" all carry `?root=<B>`, and Connect runs `claude mcp add` with that URL
- [ ] In your own repo that ran VibeDoc before the hub, run `npx vibedoc`, paste the two printed commands into zsh → Claude Code reconnects and `vibedoc_get_status` answers for that repo
- [ ] Open Settings → Connect agent → the command shows quoted (`'http://…/api/mcp?root=…'`) and copies cleanly
### Regression risk
- [ ] An agent connected with the old root-less `…/api/mcp` URL still answers for the hub's default project
