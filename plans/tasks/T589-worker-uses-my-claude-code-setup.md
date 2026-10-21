# T589: "Use my Claude Code setup" for workers
**Status:** 👀 Review
**Phase:** R113 — Worker sessions like Claude Code
**Size:** M
**Depends on:** T588
**Covers:** S4
**Owner:** ai:claude
**Due:** 2026-10-24
**Started:** 2026-10-21

## Goal
With "Use my Claude Code setup" on (the default), a worker loads the user's plugins, skills, hooks, MCP servers and CLAUDE.md, like typing `claude` in the worktree. "Isolated" keeps today's behaviour.

## Context
- Epic: `plans/roadmap/R113-worker-sessions-like-claude-code.md`
- ADR-007 § Spike chose isolation: with user settings, 5 SessionStart hooks ran, 24 plugins loaded, 78 tools were available. That stays available as "Isolated" (`workers.setup: "isolated"`). Update ADR-007 with this decision (a new section, not a rewrite).
- Mine = `--setting-sources user,project,local`, no `--tools` limit (the default set), no `--strict-mcp-config` (the user's MCP servers plus VibeDoc's from `--mcp-config`), VibeDoc's plugin still via `--plugin-dir` when the user doesn't have `vibedoc@vibedoc` installed. Deny rules and the worker prompt stay.
- Spike first: does a user SessionStart hook (e.g. Orca's, which needs its own env vars) fail a worker turn? The worker env is minimal (`workers.env` adds names).

## Scope
- [ ] `workers.setup: "mine" | "isolated"` (default mine), Settings → Workers and the run card
- [ ] `workerArgs` builds both shapes; review turns keep no Edit/Write either way
- [ ] Spike notes + ADR-007 addendum
- [ ] i18n en + vi; site page `concepts/agent-runs.md` explains both

**Out of scope:** an approval card; per-run plugin pickers.

## Files
- `src/lib/worker-args.ts` + check, `src/lib/core.ts`, the workers routes, `WorkersSettings.tsx`, `RunCard.tsx`, `src/i18n/workers.ts`, `docs/architecture/decisions/ADR-007-orchestrator-and-workers.md`, the site page

## Acceptance criteria
- [ ] Mine: argv has `--setting-sources user,project,local`, no `--tools`, no `--strict-mcp-config`; Isolated: today's argv (S4)
- [ ] A worker with Mine reaches the user's skills (the stub e2e checks the argv; a manual check on a real run)
- [ ] `git push` / `gh` still denied in both

## Verify
```bash
node src/lib/worker-args.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH BASE=http://localhost:3081 node e2e/worker-run.mjs
```

## Manual tests
_2026-10-21 — ai_
### Steps
- [x] S4 — WHEN "Use my Claude Code setup" is on → THEN the worker has the user’s plugins, skills and MCP servers, and with it off only VibeDoc’s
- [ ] Settings → Workers → Setup shows "My Claude Code setup" selected; "Also my MCP servers" is unticked; switch to Isolated, Save, reload → it stays
- [ ] Work with agent → the run card has "Setup: My Claude Code setup"
- [ ] A real worker on one of your epics → its commits follow your global CLAUDE.md (no attribution lines) and it can use your skills
- [ ] Tick "Also my MCP servers" → the next run card says "My Claude Code setup + my MCP servers"
### Regression risk
- [ ] Isolated still runs workers exactly as before R113 (six tools, project settings)
- [ ] _Spike (claude -p 2.1.305, worker env): isolated 6 tools / 23 skills / 7.6k context; mine + strict MCP 26 tools / 24 plugins / 151 skills / 33.7k; mine + all MCP 309 tools / 34 servers (mail, drive, calendar connectors) / 42.4k, so MCP stays opt-in. Hooks ran fine; VibeDoc’s plugin loads once. Live run (no stub) on a fixture epic: mode auto, 24 plugins, task + review turns with 0 permission denials ($0.36 + $0.26), commit `fix(greet): add comma and exclamation mark to greeting` with no attribution (the user’s CLAUDE.md applied), check passes. Checks: worker-args.check (both setups, MCP opt-in, review keeps 4 tools, push/gh denied). e2e with the stub: worker-run, worker-verify, agent-runs, orchestrator, worker-ask, worker-restart, worker-frontend pass (worker-restart caught `claude --help` running in the project folder; it now runs in the temp folder). ADR-007 has an addendum with the numbers._
