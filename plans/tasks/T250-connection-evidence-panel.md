# T250: Connection evidence + Connect panel with a live MCP step
**Status:** 👀 Review
**Phase:** R081 — Connect your agent
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S2
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
VibeDoc records the first real MCP tool call from an agent and a "Connect your agent" panel in Settings shows the MCP step turning ✓ live, with the agent's name. This is the proof half of the epic; every later task plugs into this panel.

## Context
- Epic: `plans/roadmap/R081-connect-your-agent.md` (spec change: `agent-connection` → "Connection status"). Don't edit `docs/specs/`; the human merges the epic's `## Spec changes`.
- Decisions from the breakdown:
  - **Evidence = `tools/call` only.** `initialize` / `tools/list` never count: `claude mcp get` / `claude mcp list` health-check servers, and Settings' Test button POSTs `tools/list` from the browser. Counting them would tick the step without an agent ever using VibeDoc.
  - Evidence is stored per project in `.vibedoc/agent-connection.json` (`{ agent, lastCall }`, ISO-8601 Z), written through `core.ts`. Write only when the agent changed or the stored `lastCall` is older than 60s (no write per call). The MCP route emits SSE `agent_connected` when the write happens.
  - Agent name: the existing `agent` the MCP route already computes (`args.agent`, else `agentFromUserAgent()` in `src/lib/owner.ts`; `KNOWN_AGENTS` has claude/cursor/codex/…; unknown → `"agent"`, shown as "an agent").
  - The panel fetches its own status (`GET /api/agent-connect` → `{ mcp: { connected, agent, lastCall } }`, later tasks add `skills`), so R082's welcome screen can mount it without Settings props. **Seam for R082/R084:** `ConnectAgentPanel` component + `getAgentConnection(root)` in core + that GET route.
  - Settings gets a `connect` tab ("Connect agent", replaces the "MCP" tab; the endpoint field + Test move into the panel's "Advanced" part) and a deep link `/settings?tab=connect` (today tabs are `useState` only). This is the link R083's empty states and R082 use.
  - MCP URL = `resolveMcpEndpoint(settings.mcp.endpoint, useOrigin())` (`src/lib/settings.ts`). Stable ports are R080's job; don't touch `bin/vibedoc.mjs`.
- CLAUDE.md rules: only `src/lib/core.ts` touches the file system; `emitUpdate()` from API routes, never from core; no `localStorage`; UI text in `src/i18n/settings.ts` (`en` + typed `vi`) via `useT()`. The "No database" paragraph lists every file VibeDoc writes: add `.vibedoc/agent-connection.json`.

## Scope
- [ ] Pure `src/lib/agent-connect.ts`: `shouldRecordCall(prev, agent, now)` (throttle rule), `parseConnection(raw)` (tolerant JSON read), formatting helpers the panel needs; self-check `src/lib/agent-connect.check.mts`
- [ ] `core.ts`: `getAgentConnection(root)` / `recordAgentCall(root, agent)` (returns whether it wrote)
- [ ] `/api/mcp` `tools/call`: call `recordAgentCall` (never fail the tool call on a write error: log and go on), `emitUpdate("agent_connected", { root, agent })` when it wrote
- [ ] `GET /api/agent-connect?root=` route
- [ ] `src/components/connect/ConnectAgentPanel.tsx`: the MCP step (URL, the `claude mcp add --transport http vibedoc <url>` command with Copy, status line "Waiting for the first call — start Claude Code in this project and ask it to call vibedoc_get_status" / "✓ Connected · claude · 2 min ago"), subscribes to SSE (`/api/events`, like `AppContext`) for `agent_connected` and refetches
- [ ] Settings: `connect` tab first in `TABS`, `?tab=` read on load; delete `MCPSettings.tsx` once its endpoint field + Test live in the panel
- [ ] CLAUDE.md file list; `e2e/connect-agent.mjs` (new, grows in T251–T254)

**Out of scope:** running any command (T251), skills (T252), Cursor/Other (T253), the welcome screen (R082), stable port (R080).

## Files
- `src/lib/agent-connect.ts`, `src/lib/agent-connect.check.mts` — new
- `src/lib/core.ts` — the two functions; follow how `readProjectSettings` reads `.vibedoc/settings.json`
- `src/app/api/mcp/route.ts` — `tools/call` branch (~line 803)
- `src/app/api/agent-connect/route.ts` — new
- `src/components/connect/ConnectAgentPanel.tsx` — new
- `src/app/(app)/settings/page.tsx`, `src/components/settings/MCPSettings.tsx` (removed)
- `src/i18n/settings.ts`, `CLAUDE.md`, `e2e/connect-agent.mjs`

## Implementation notes
- Pure libs never import values from each other (checks run with plain `node`).
- e2e pattern: `e2e/specs.mjs` (`makeFixture`, `launchChrome`, `stubChat` from `e2e/stub-chat.mjs`, `BASE` env). Run the dev server on port 3081.

## Acceptance criteria
- [ ] A `tools/call` POST to `/api/mcp?root=<fixture>` with `User-Agent: claude-code/2.1` turns the open panel's MCP step ✓ "claude" without a reload
- [ ] The panel's Test button and a plain `tools/list` / `initialize` POST leave the step unticked
- [ ] A reload keeps ✓ (read from `.vibedoc/agent-connection.json`); a second call within 60s doesn't rewrite the file
- [ ] `/settings?tab=connect` opens on the panel; every new string has `en` + `vi`
- [ ] `node src/lib/agent-connect.check.mts` passes; `e2e/connect-agent.mjs` covers the three points above

## Verify
```bash
node src/lib/agent-connect.check.mts
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3081 pnpm dev:next &   # then:
BASE=http://localhost:3081 node e2e/connect-agent.mjs
```

## Manual tests
_2026-10-07 — ai:claude-code_
### Steps
- [ ] S2 — WHEN the connected agent makes its first VibeDoc call → THEN the MCP step turns ✓ without a reload
- [ ] Open `/settings?tab=connect` → "Connect agent" (first in the section list) opens; the MCP step shows the `claude mcp add …` command with this app's URL and "Waiting for the first call"
- [ ] Click Copy on the command → it reads Copied and the clipboard holds the command
- [ ] Under Advanced, click Test → "Connection successful", and the MCP step still says Waiting
- [ ] In a terminal in the project, start Claude Code (already connected) and ask it to call vibedoc_get_status → the step turns ✓ "Connected · Claude Code · last call …" without a reload
- [ ] Switch the language to Tiếng Việt → the panel is in Vietnamese
### Regression risk
- [ ] Other Settings sections (Appearance, Frontend app) still open and save; `/settings` with no `?tab=` works

Automated: `e2e/connect-agent.mjs` (deep link, Test/initialize/tools/list don't tick, tools/call ticks live with the agent name, reload keeps it, no rewrite within 60s) passed against `next dev -p 3081`.

## Notes
- `MCPSettings.tsx` was kept as the Connect tab's wrapper (panel + the Advanced endpoint field and Test) instead of being deleted; its wrong per-agent config list is gone (T253 brings Cursor/Other back inside the panel).
- `/settings` with no `?tab=` still opens Appearance (e2e/i18n.mjs switches the language there); Connect is first in the list and reached by `?tab=connect`.
- VibeDoc's own chat (`/api/chat` → `claude -p`) would have ticked the step on its first tool call; its `--mcp-config` now sends `x-vibedoc-chat: 1` and `/api/mcp` doesn't record those calls (e2e step 2 checks it).
- Panel text lives in a new i18n area `src/i18n/connect.ts` (the panel is also mounted outside Settings by R082).
- Seam for R082 / R084: `<ConnectAgentPanel />` (no props needed), `GET /api/agent-connect` → `{ mcp }`, `getAgentConnection(root)` in core, SSE `agent_connected`. Deep link: `/settings?tab=connect`.
