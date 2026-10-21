# T589: "Use my Claude Code setup" for workers
**Status:** 📋 Todo
**Phase:** R113 — Worker sessions like Claude Code
**Size:** M
**Depends on:** T588
**Covers:** S4

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
