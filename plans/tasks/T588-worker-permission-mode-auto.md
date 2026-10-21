# T588: Worker permission mode: Auto by default, review turns run their checks
**Status:** 📋 Todo
**Phase:** R113 — Worker sessions like Claude Code
**Size:** M
**Depends on:** —
**Covers:** S1, S2, S3, S5

## Goal
A worker's `claude -p` runs in a permission mode the user picks (Auto by default, or Accept edits), so a task's commands (pipes, env-prefixed commands, builds) run without silent denials, and the review turn can re-run the checks without being able to edit.

## Context
- Epic: `plans/roadmap/R113-worker-sessions-like-claude-code.md`
- Spike (2026-10-21, Claude Code 2.1.305, `claude -p`): in mode `default`, `pnpm build 2>&1 | tail -3` is denied; in `--permission-mode auto` it runs, as do `python3 -c …` and `FOO=1 node x.mjs`. `--disallowedTools 'Bash(git push*)'` still refuses `git push` in auto. Auto is not a sandbox: the worktree, the deny rules and the budget remain the fence.
- Worker R109's log: 26 denials in 9 turns; the 4 review turns (VERIFY_ALLOWED = git diff/log only) had 9 of 11 Bash calls denied.
- `claude --help` lists the `--permission-mode` choices. An older CLI without `auto` must not break runs: fall back to `acceptEdits` + the allowlist, and say so on the run card.

## Scope
- [ ] `src/lib/worker-args.ts`: `permissionMode` input → `--permission-mode <mode>` on task, fix and review turns; review turns keep `VERIFY_TOOLS` (no Edit/Write) and their allowlist gains the read-only and check commands (node, pnpm, npm, npx, grep, ls, cat, head, tail, wc, git show/diff/log) for the acceptEdits fallback
- [ ] Widen the default `WORKER_ALLOWED` with read-only utilities (ls, cat, head, tail, wc, grep, rg, find, echo, sort, diff, pwd, which, mkdir, sed -n, git show/branch/rev-parse/ls-files, yarn, bun, tsc) for the acceptEdits fallback
- [ ] `workers.mode` in `.vibedoc/settings.json` (`auto` | `acceptEdits`, default `auto`), Settings → Workers select; the run card shows the mode and lets this run use the other one (POST /api/workers `mode`... stored on the worker)
- [ ] CLI support: process-only check of `claude --help` for `auto` (cached); without it the run uses `acceptEdits` and the run card says "Auto mode needs a newer Claude Code"
- [ ] i18n en + vi; docs `site/.../concepts/agent-runs.md` + `docs/desktop-app.md` untouched

**Out of scope:** the user's setup / setting sources (T589); Plan mode; an approval card.

## Files
- `src/lib/worker-args.ts`, `src/lib/worker-args.check.mts`
- `src/lib/core.ts` (`WorkerSettings.mode`), `src/app/api/workers/deps.ts`, `src/app/api/workers/route.ts`, `src/app/api/workers/propose/route.ts`, `src/lib/claude-cli.ts`
- `src/components/settings/WorkersSettings.tsx`, `src/components/workers/RunCard.tsx`, `src/i18n/workers.ts`
- `e2e/fixtures/claude-stub/claude` (help output lists the modes), `e2e/worker-run.mjs`

## Acceptance criteria
- [ ] A task turn's argv has `--permission-mode auto` by default; `workers.mode: "acceptEdits"` gives `acceptEdits`
- [ ] A review turn's argv has the same mode, no Edit/Write tools, and its allowlist includes `Bash(node *)` and `Bash(pnpm *)`
- [ ] `--disallowedTools` still has `Bash(git push*)` and `Bash(gh *)` in every mode (S3)
- [ ] A CLI whose help lacks `auto` → the run uses `acceptEdits` and the run card says why (S5)
- [ ] Settings → Workers saves the mode; the run card shows it

## Verify
```bash
node src/lib/worker-args.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH BASE=http://localhost:3081 node e2e/worker-run.mjs
```
