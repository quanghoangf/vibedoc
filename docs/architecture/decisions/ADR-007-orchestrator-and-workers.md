# ADR-007: Workers run task by task in a worktree, started from a run card

**Status:** 📝 Proposed
**Date:** 2026-10-20

## Context
R108 lets the user start a coding agent on an epic or a task from VibeDoc. The agent writes code in its own git worktree, and the board follows its progress. This ADR records the decisions. T552 writes the Decision, Alternatives and Consequences sections. The Spike section below holds the evidence from T566, which the decisions build on.

## Spike (T566)
Run on 2026-10-20 with Claude Code 2.1.304 on macOS against this repo. The hub ran at `localhost:3333`. A throwaway task `T999` ("create `spike.txt`, then try `git push` once") was created in the main checkout and removed afterwards. The worktree was `/tmp/r108-spike` on branch `spike/r108`, created from `main`. Raw NDJSON is not kept in the repo. The excerpts below are copied from it.

### Results
| Question | Answer | Evidence |
|---|---|---|
| Worktree + install cost | `git worktree add`: 0.6 s. `pnpm install --frozen-lockfile --prefer-offline`: 10.6 s (warm pnpm store) | timings |
| Does `/vibedoc:work <id>` run headless? | **Yes**, with `--plugin-dir <repo>/plugin`. `init.slash_commands` lists `vibedoc:work`. The agent followed the skill: `get_task` → `update_task in-progress` → work → Verify → commit → `update_task done` + manual tests. No `--append-system-prompt` fallback is needed. It also handled a task id, although the skill only documents epic ids | run A |
| Board follows (S2) | **Yes.** MCP `?root=<main checkout>`: `T999` became in-progress, then review, in the **main** checkout's file, and the board moved | run A, `plans/tasks/T999…` |
| Isolation (S1) | **Yes.** `spike.txt` and commit `fca4246` exist only on `spike/r108`. Main `git status` had no code change | run A |
| Task file in the worktree | The skill tried `git add plans/tasks/T999-….md` and failed: the file was only in the main checkout. In a real repo the worktree has a stale copy. The worker prompt must say: commit code only, VibeDoc owns task files | run A |
| `done` with checks left | It went to **review** (3 manual checks). The loop must treat review as finished for the worker | run A |
| User settings leak in | With default setting sources, 5 user `SessionStart` hooks ran, 24 plugins loaded, and 78 tools were available (`Task`, `Workflow`, `WebFetch`, `Cron*`, `PushNotification`, `EnterWorktree`…). The user-level CLAUDE.md also applied | run A `init` |
| Fix | `--setting-sources project,local` plus `--tools "Bash,Edit,Write,Read,Glob,Grep"`. Result: no hooks, only VibeDoc's plugin (+ built-ins), 6 built-in tools. The project `CLAUDE.md` still loads (it answered the "no `fs` outside core.ts" rule) and the user's does not (no Kotlin `!!` rule) | run B |
| Refusal: deny rule | `git push` (also inside `a && b && git push`) was refused. The stream shows a `system` event `{"subtype":"permission_denied","tool_name":"Bash","tool_use_id":…,"decision_reason_type":"subcommandResults","message":"Permission to use Bash with command git push --dry-run has been denied."}`, a `tool_result` with `is_error: true`, and `result.permission_denials: [{tool_name, tool_use_id, tool_input}]` | runs A, B |
| Refusal: not on the allowlist | `curl -sI https://example.com` → `decision_reason_type: "other"`, message `"This command requires approval"`. Simple read-only commands not on the list (`ls`, `echo hi`) ran without approval | run B |
| Minimal env | `env -i PATH HOME USER SHELL LANG TERM TMPDIR` was enough. The login came from the macOS keychain, and no token in env was needed | runs A–D |
| `--max-turns` | Counts **model round trips**, not tool calls: 26 Glob calls in one message counted as one turn (run C, `--max-turns 2`, success). With sequential calls (run C2): exit code **1**, `result.subtype: "error_max_turns"`, `terminal_reason: "max_turns"`, `errors: ["Reached maximum number of turns (2)"]` | runs C, C2 |
| Usage limits | Every turn streams a `rate_limit_event`: `{"rate_limit_info":{"status":"allowed","rateLimitType":"five_hour","resetsAt":1792478400,"unifiedWindows":{"five_hour":{"utilization":0.43,…},"seven_day":{"utilization":0.06,…}}}}`. A rejected status was **not observed** (Unknown). The utilization lets a worker pause before it hits the limit | run A |
| Session files | `~/.claude/projects/-private-tmp-r108-spike/<session>.jsonl` (slug of the cwd) | run A |
| `--resume` from another cwd | **Found the session anyway**, and then ran in the *new* cwd (the main checkout). So resume does not tie a session to its folder: VibeDoc must always pass the worktree as cwd, or a resumed worker edits the user's checkout | run D |
| Cost of one trivial task (Opus 5.5, user settings) | 38 s wall, 33 s API, `total_cost_usd` 0.73 (list price; on a subscription this is quota), 66,894 cache-creation and 708,649 cache-read input tokens, 2,437 output | run A `result` |
| Base context per fresh session (project settings only, Haiku) | 53,936 cache-creation tokens. Most of it is the project `CLAUDE.md` with its `@` includes (MEMORY.md is large) plus the 50 VibeDoc MCP tool definitions. Every task pays this once | run B `result` |
| Resume cost | Run D (resume with another model, history of run A) created 115,169 cache tokens for a one-word reply. A resume re-reads the whole session, so resume only for questions, never as the task loop | run D |

### What this changes in the tasks
- T554: argv adds `--setting-sources project,local` and `--tools "Bash,Edit,Write,Read,Glob,Grep"` (not "default sources"). The `--append-system-prompt` fallback is not needed. The worker prompt says to commit code only. Review counts as finished.
- T556 / T558: always spawn a resume with cwd = the worktree. The session file is found from any cwd, so the cwd is the only guard.
- T557: parse refusals from `system/permission_denied` (`decision_reason_type` = `subcommandResults` for a deny rule, `other` for "not allowed") and `result.permission_denials`. The minimal env above works.
- T567: detect over-budget from exit 1 + `result.subtype: "error_max_turns"`. Turns are round trips. Read `rate_limit_event.rate_limit_info` for utilization and `resetsAt`, and pause above a threshold. The rejected shape is still unknown, so also treat a non-zero exit whose text mentions a limit as a usage limit.
