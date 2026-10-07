# T252: Skills step: detect, install, try /vibedoc:roadmap
**Status:** 📋 Todo
**Phase:** R081 — Connect your agent
**Size:** M (2–3 hrs)
**Depends on:** T251
**Covers:** S3

## Goal
For Claude Code the panel has a second step: the `vibedoc` plugin (the `/vibedoc:*` skills). It shows ✓ when the plugin is installed, offers one-click install after a confirm, and once ✓ points at `/vibedoc:roadmap` as the next thing to try.

## Context
- Epic: `plans/roadmap/R081-connect-your-agent.md` (spec: "Connection status": done only from evidence — the plugin found).
- Decisions from the breakdown:
  - Detection: `claude plugin list --json` (array of `{ id, scope, enabled, projectPath? }`); installed = an entry with id `vibedoc@<any marketplace>`, `enabled: true`, and `scope: "user"` or `projectPath === root`. Not found / CLI missing → not done (with the reason).
  - Install (after confirm, showing both commands): `claude plugin marketplace add quanghoangf/vibedoc` then `claude plugin install vibedoc@vibedoc` (same commands as README.md:58–59). A marketplace that already exists is not an error; read the CLI's message and go on to install.
  - **Live ✓ is polled, not pushed:** a user who runs `/plugin install` inside Claude Code never calls VibeDoc. The panel re-checks on window focus and every 10s while the step isn't done (stop once done / unmounted).
  - Commands go through `src/lib/claude-cli.ts` (T251), same POST route `step: "skills"`, same guards (same-origin, not demo), `emitUpdate` after an install.
  - `GET /api/agent-connect` adds `skills: { installed, reason? }`.
  - The skills step shows only for Claude Code (T253 hides it for Cursor/Other).
- CLAUDE.md: add the plugin install to the "No database" list next to T251's line.

## Scope
- [ ] `claude-cli.ts`: `pluginList(root)`, `pluginInstall(root)`; pure `pluginInstalled(list, root)` in `src/lib/agent-connect.ts` + check cases
- [ ] Route GET/POST additions
- [ ] Panel: skills step (status, Install → confirm → result, error + fix + copy both commands), polling, ✓ line "Try `/vibedoc:roadmap` in Claude Code" with Copy
- [ ] i18n; e2e: the stub's `plugin list --json` toggles from without to with `vibedoc@vibedoc` and the step ticks without a reload

**Out of scope:** updating or removing the plugin, other agents' skills.

## Files
- `src/lib/claude-cli.ts`, `src/lib/agent-connect.ts`, `src/lib/agent-connect.check.mts`
- `src/app/api/agent-connect/route.ts`, `src/components/connect/ConnectAgentPanel.tsx`
- `src/i18n/settings.ts`, `CLAUDE.md`, `e2e/connect-agent.mjs`, `e2e/fixtures/claude-stub/claude`

## Acceptance criteria
- [ ] Plugin not installed → step open with Install; confirm runs marketplace add + install; result shown
- [ ] Plugin installed elsewhere (stub list changes) → ✓ within ~10s or on focus, no reload, and `/vibedoc:roadmap` is shown as the next step
- [ ] A `vibedoc@…` entry disabled, or project-scoped to another path → not ✓
- [ ] Unit check covers `pluginInstalled`; e2e covers install + external install

## Verify
```bash
node src/lib/agent-connect.check.mts
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH PORT=3081 pnpm dev:next &
BASE=http://localhost:3081 node e2e/connect-agent.mjs
```

## Manual tests
- [ ] S3 — WHEN the vibedoc plugin is installed in Claude Code → THEN the skills step shows ✓ and lists `/vibedoc:roadmap` as the next thing to try
