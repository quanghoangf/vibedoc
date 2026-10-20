# T566: Spike: headless claude -p in a worktree on a real task
**Status:** ✅ Done
**Owner:** ai:claude
**Started:** 2026-10-20
**Done:** 2026-10-20
**Phase:** R108 — Agent runs in a worktree
**Size:** S (~2 hrs)
**Depends on:** —
**Covers:** S1, S4, S10

## Goal
Answer the unknowns the rest of R108 is built on, by hand, before any code: does a headless worker run the skill, what does a refusal look like, how does a usage limit show up, how big does one task's context get.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`
- Every later task depends on these answers: T554 (argv, skill), T557 (refusal shape, env), T567 (budget flags, usage-limit shape), T556 (session files per cwd).
- Run it on this repo, on one small `📋 Todo` task of any epic, in a throwaway worktree. Point MCP at a running VibeDoc with `?root=<main checkout>`.

## Scope
- [x] `git worktree add /tmp/r108-spike -b spike/r108 main` + `pnpm install` there; time both
- [x] Run, from the worktree: `claude -p "/vibedoc:work <T-id>" --output-format stream-json --verbose --plugin-dir <repo>/plugin --strict-mcp-config --mcp-config '<vibedoc ?root=main>' --allowedTools "Edit Write Read Glob Grep Bash(pnpm *) Bash(git add *) Bash(git commit *) mcp__vibedoc__*" --disallowedTools "Bash(git push*)" --max-turns 60` and save the NDJSON
- [x] Record: did the slash command run the skill headless? (if not, retry with the skill text via `--append-system-prompt`)
- [x] Record: the exact stream shape of a refused call (ask it to `git push`): `permission_denials` in `result`? a `tool_result` with `is_error`?
- [x] Record: what `--max-turns` hitting its limit prints (`result.subtype`?), and what a usage limit / 429 looks like (from docs or a real hit; say which)
- [x] Record: where the session file lands (`~/.claude/projects/<slug of the worktree>/`), and that `--resume <id>` only finds it from the same cwd
- [x] Record: turns, duration, cost / tokens of one task (`result` event), and the env the child needs (which vars it actually used)
- [x] Write the findings into `docs/architecture/decisions/ADR-007-orchestrator-and-workers.md` § Spike (T552 writes the rest), with the NDJSON excerpts
- [x] Remove the spike worktree and branch

**Out of scope:** any code in `src/`.

## Files
- `docs/architecture/decisions/ADR-007-orchestrator-and-workers.md` — § Spike (create the file if T552 hasn't yet)

## Acceptance criteria
- [x] Each "Record" item has an answer with evidence (an NDJSON excerpt or a doc link), or "Unknown" with why
- [x] If any answer breaks an assumption in T554 / T556 / T557 / T567, the affected task file gets a `> [!WARNING]` note naming the change

## Verify
```bash
git worktree list   # spike worktree gone
pnpm build:cli && node bin/vibedoc.mjs check --root .
```

## Manual tests
_2026-10-20 — ai:claude · spike, no code_
- [x] S1 — WHEN the user accepts a run card for a new worktree → THEN a new worktree and branch exist, the worker's commits land only there, and the user's checkout has no code changes
- [x] S4 — WHEN the worker tries a command it was not allowed (e.g. `git push`) → THEN it is refused, and the worker's log shows what was refused
- [ ] S10 — WHEN a task runs past its turn or time budget, or the account hits a usage limit → THEN the worker stops that task and waits on the user (budget) or shows paused and continues by itself later (usage limit), never burns on (spike: max-turns shape proven, run C2; a rejected usage limit was not observed, see ADR-007)
