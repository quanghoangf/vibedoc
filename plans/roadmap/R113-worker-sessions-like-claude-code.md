# R113: Worker sessions like Claude Code
**Parent:** R002
**Status:** in-progress
**Order:** 540
**Tasks:** T588, T589

An agent run works like the user's own Claude Code session: it runs the commands a task needs without stopping on permission errors, with the user's plugins, skills and settings, while push and PR stay the user's.

**In scope:** a permission mode per run (Auto by default, or Accept edits), set in Settings → Workers and on the run card; the review turn may run checks but never edit; a "Use my Claude Code setup" option (on by default) that loads the user's plugins, skills, hooks, MCP servers and CLAUDE.md, with "Isolated" (today's behaviour) still available; a fallback when the user's Claude Code has no Auto mode
**Out of scope:** a Plan mode for runs (needs a plan-approval step), an approval card in the worker chat (`--permission-prompt-tool`, later), an embedded interactive terminal, bypassing permissions
**Done when:** a worker runs a task whose Verify uses pipes, env-prefixed commands and a build, and its review re-runs the checks, with no permission denial in its log, while `git push` is still refused

## Scenarios
### S1: Commands run without approvals
- WHEN a worker in Auto mode runs `pnpm lint 2>&1 | tail -5` or `FOO=1 node script.mjs`
- THEN the command runs, and no permission denial shows in the worker chat
### S2: The review re-runs the checks
- WHEN a task's review turn runs its Verify commands
- THEN they run, and the review can't edit or write files
### S3: Push stays the user's
- WHEN a worker tries `git push` or `gh` in any mode
- THEN it is refused
### S4: The user's setup
- WHEN "Use my Claude Code setup" is on
- THEN the worker has the user's plugins, skills and MCP servers, and with it off only VibeDoc's
### S5: No Auto mode
- WHEN the installed Claude Code has no Auto mode
- THEN the run card says so and the worker runs in Accept edits with the allowlist
