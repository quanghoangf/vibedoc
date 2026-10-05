# T211: Install with your AI assistant prompt
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-05
**Phase:** R073 — Install with your AI assistant
**Size:** M (2–3 hrs)
**Depends on:** T210

## Goal
A user pastes one prompt into Claude Code, Cursor or another agent; it installs VibeDoc, connects it over MCP, adds the /vibedoc:* commands where it can, and reports what actually happened.

## Context
- Epic: `plans/roadmap/R073-install-with-your-ai-assistant.md`.
- Decision: fixed port 3333 (`npx vibedoc --port 3333` in the background), so `http://localhost:3333/api/mcp` stays valid across restarts. Claude Code: `claude mcp add --transport http vibedoc …` and `/plugin marketplace add quanghoangf/vibedoc` + `/plugin install vibedoc@vibedoc`; Cursor: `.cursor/mcp.json`; anything else: print the URL.
- The prompt asks before anything needing admin rights, never edits shell startup files, never changes the Node version (needs Node ≥ 20.9).

## Scope
- [ ] One prompt text, single source `site/src/data/ai-install.ts`, rendered as an "Ask your AI" tab on the landing page and on a docs page `/docs/ai-install/`
- [ ] Prompt steps: check Node → start VibeDoc on 3333 (reuse if already answering) → connect MCP for the detected tool → install the plugin (Claude Code) → verify by calling `vibedoc_get_status` → report a checklist of done / skipped / failed

**Out of scope:** per-IDE installers, changing Node.

## Files
- `site/src/data/ai-install.ts` — new; `site/src/data/install.ts`, `InstallTabs.astro` — the tab
- `site/src/content/docs/docs/ai-install.md` (or `.mdx`) — page
- `site/e2e/landing.spec.ts`, `site/e2e/docs.spec.ts`

## Acceptance criteria
- [ ] The landing install tabs have "Ask your AI" with a copy button that copies the full prompt
- [ ] The docs page shows the same prompt
- [ ] The prompt names port 3333, the MCP command, the plugin install, the admin-rights rule and the report

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
### Steps
- [x] 🤖 On the landing page pick the "Ask your AI" install tab → the prompt starts "Install VibeDoc …" and Copy prompt copies the whole prompt (port 3333, `claude mcp add`, plugin install, admin-rights rule, report)
- [x] 🤖 Click "Read the full prompt" → the docs page "Install with your AI assistant" shows the same prompt
- [ ] Epic done-when: in a fresh project, paste the prompt into Claude Code → VibeDoc runs on :3333, `claude mcp list` shows vibedoc connected, and after a restart /vibedoc:roadmap is available; the agent's checklist report says so
- [ ] Paste it into Cursor → `.cursor/mcp.json` gains a vibedoc entry and keeps the servers already there
- [ ] With something else on port 3333 → the agent stops and asks which port to use
### Regression risk
- [ ] The other install tabs (npx, npm, pnpm, bun, Homebrew) still show and copy their one-line command
