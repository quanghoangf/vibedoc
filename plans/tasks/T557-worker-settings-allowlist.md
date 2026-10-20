# T557: Worker settings: allowlist, minimal env, max workers
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T554
**Covers:** S4

## Goal
The user controls what a worker may run, what environment it gets and how many workers run at once, and sees every refused call in the worker's log.

> [!WARNING]
> Spike T566: refusals = `system` event `permission_denied` with `decision_reason_type` `subcommandResults` (a deny rule, e.g. `git push`, also inside `a && git push`) or `other` ("This command requires approval", not on the allowlist), plus `result.permission_denials[{tool_name, tool_use_id, tool_input}]`. Simple read-only commands (`ls`, `echo`) run without being listed. `env -i PATH HOME USER SHELL LANG TERM TMPDIR` is enough: the login comes from the macOS keychain.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007 ("the allowlist is not a sandbox")
- `.vibedoc/settings.json` `workers: { allowedTools: string[], maxRunning: number, env: string[] }`; read via `readProjectSettings()` (`src/lib/core.ts:1444`). Defaults: the spike's allowlist, `maxRunning: 2`, `env: []`. `Bash(git push*)` and `Bash(gh *)` are always denied (a constant, not a setting).
- **Minimal env.** Today chats get `{ ...process.env }` minus `ANTHROPIC_API_KEY`. A worker gets only `PATH HOME USER SHELL LANG TERM TMPDIR` + the names in `workers.env` + `PORT` (T559). So tokens in VibeDoc's env (`GITHUB_TOKEN`, cloud keys) never reach the agent. The app's own `.env` files are read by the app itself from the worktree, which is unchanged. Check the spike's list of vars the child actually used.
- Refusals: use the stream shape T566 recorded (e.g. `result.permission_denials`); the stub prints the same shape.
- Rule (global): no magic numbers → defaults live with the other defaults in core.

## Scope
- [ ] Settings fields + defaults; `readProjectSettings` returns them
- [ ] `workerArgs` takes the list; the deny constant is always appended
- [ ] Pure `workerEnv(processEnv, extra)` in `src/lib/worker-args.ts`; self-check (a `*_TOKEN` var is dropped unless listed)
- [ ] `POST /api/workers` refuses (409, message) at `maxRunning`
- [ ] Settings → Workers tab: allowed tools (one per line), env names, max running; a line saying the allowlist limits tools and is not a sandbox
- [ ] Pure `refusedCalls(streamLines)` in `src/lib/worker-state.ts` → `{tool, input}`; the chat shows a "Refused" row per call
- [ ] `RunCard` shows the list it will use

**Out of scope:** per-run overrides in the run card; budgets (T567).

## Files
- `src/lib/core.ts`, `src/lib/worker-args.ts`, `src/lib/worker-state.ts` (+ checks)
- `src/app/api/workers/route.ts`
- `src/app/(app)/settings/…` — Workers tab; `src/i18n/workers.ts`
- `src/components/chat/ChatView.tsx`, `src/components/workers/RunCard.tsx`
- `e2e/fixtures/claude-stub/claude` — a turn that tries `git push` and prints its env

## Acceptance criteria
- [ ] A setting without the push deny still spawns with it denied (`.claude-stub.log`)
- [ ] The stub's `git push` attempt shows as a Refused row naming the command (S4)
- [ ] VibeDoc started with `GITHUB_TOKEN=x` → the stub's printed env has no `GITHUB_TOKEN`; with `workers.env: ["GITHUB_TOKEN"]` it does
- [ ] With `maxRunning: 1` and one worker running, a second start → 409 naming the limit

## Verify
```bash
node src/lib/worker-args.check.mts && node src/lib/worker-state.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-run.mjs
```

## Manual tests
- [ ] S4 — WHEN the worker tries a command it was not allowed (e.g. `git push`) → THEN it is refused, and the worker's log shows what was refused
