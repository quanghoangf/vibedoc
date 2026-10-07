# T253: Cursor and other agents: paste config, same live ✓
**Status:** 👀 Review
**Phase:** R081 — Connect your agent
**Size:** S (~1 hr)
**Depends on:** T250
**Covers:** S4
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
The panel's agent picker offers Claude Code, Cursor and Other. Cursor and Other get the config to paste (with the current MCP URL and where it goes) and the same live MCP ✓ from T250.

## Context
- Epic: `plans/roadmap/R081-connect-your-agent.md`. Out of scope: IDE-specific installers, several agents per project.
- The old `AGENT_CONFIGS` in the removed `MCPSettings.tsx` were wrong (Cursor used `mcp.servers`; Claude Code pointed at `~/.claude/claude.json`). Check the current Cursor format with Context7 before writing it; expected `.cursor/mcp.json` (project) or `~/.cursor/mcp.json`: `{ "mcpServers": { "vibedoc": { "url": "<mcp-url>" } } }`.
- "Other": generic Streamable-HTTP MCP config (`url`) plus the bare URL, with one line that the agent must support HTTP MCP servers.
- Picking an agent is per browser, not stored in project files: keep it in component state (or a cookie like `vibedoc-lang` if it must survive reloads; no `localStorage`). Default: Claude Code.
- No new commands are run for these agents; the skills step (T252) is Claude Code only.

## Scope
- [ ] Picker (segmented control) in `ConnectAgentPanel`; per agent: steps shown, config block + Copy, file path hint
- [ ] The MCP step's waiting text names the picked agent ("start Cursor in this project and ask it to call vibedoc_get_status")
- [ ] i18n; e2e: pick Cursor → config contains the URL under `mcpServers.vibedoc.url`, no skills step; a `tools/call` with `User-Agent: Cursor/1.0` ticks ✓ "cursor"

**Out of scope:** writing `.cursor/mcp.json` for the user; Windsurf-specific tab (Other covers it).

## Files
- `src/components/connect/ConnectAgentPanel.tsx`, `src/i18n/settings.ts`, `e2e/connect-agent.mjs`

## Acceptance criteria
- [ ] Cursor → paste config valid JSON with the current MCP URL and the right file path
- [ ] Other → URL + generic config
- [ ] The first `tools/call` from that agent ticks ✓ live with its name
- [ ] e2e covers both

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
- [ ] S4 — WHEN the user picks Cursor or "Other" → THEN they get the config to paste, and the MCP step still turns ✓ on the first call
- [ ] Settings → Connect agent → pick Cursor → the MCP step shows a JSON block (`mcpServers.vibedoc.url` = this app's MCP URL) to paste into `.cursor/mcp.json`; the Skills step is gone
- [ ] Paste it into a real project's `.cursor/mcp.json`, open Cursor's agent and ask it to call vibedoc_get_status → the step turns ✓ "Connected · Cursor" without a reload
- [ ] Pick Other → the same JSON plus the bare URL, each with Copy
- [ ] Pick Claude Code again → Connect Claude Code and the Skills step are back
### Regression risk
- [ ] Phone width (390px): the picker wraps, no horizontal scroll on Settings → Connect agent

Automated: `e2e/connect-agent.mjs` step 7 (Cursor config JSON with the URL, no Connect button / skills step, waiting text names Cursor, Other shows the URL, a `Cursor/1.7` tools/call ticks ✓ "Cursor") passed against `next dev -p 3081`. Cursor's format checked with Context7 (cursor.com/docs/mcp: `{ "mcpServers": { "<name>": { "url": … } } }`, project `.cursor/mcp.json`).

## Notes
- The picked agent is component state (resets to Claude Code on reload); no cookie, nothing stored.
