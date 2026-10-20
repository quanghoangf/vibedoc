# T568: Verify each task before the next
**Status:** 👀 Review
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T554, T558
**Covers:** S11
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
Nobody reads the code while a worker runs, so each finished task gets a verification review (R067) in the loop; critical or major findings are fixed once, else the worker waits on the user before it claims the next task.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- R067 already does the review: `verifyTask()` (`src/lib/ask-agent.ts:17`) sends "Verify task T…: call vibedoc_verify_context, then vibedoc_report_findings"; findings land in the task's `## Verification` (`src/lib/verification.ts`).
- **Gotcha:** `getVerifyContext` (`src/lib/core.ts:1699`) runs `git log -F --grep=<id>` in the **main root**, on its HEAD, so it can't see commits on the worker's branch. Worktrees share the repo, so pass the branch: an optional `ref` (the worker's branch) for the log and the diff, set when the call carries `x-vibedoc-worker`.
- Loop step after a task is done or in review (T554's `nextStep`):

<!-- vibedoc:steps -->
- **Verify** — a fresh `claude -p` in the worktree with the verify prompt (read-only tools: Read, Glob, Grep, `Bash(git diff*)`, `Bash(git log*)`, vibedoc MCP)
- **Clean or minor only** — claim the next task
- **Critical or major** — one fix turn: `--resume` the task's session with the findings (`formatFindingsNote` in verification.ts), then verify again
- **Still critical or major** — the task is sent back (normal send-back note), the worker waits on the user

- Setting `workers.verify: true` (default) to turn it off.

## Scope
- [ ] `getVerifyContext(taskId, root, {ref})` + the MCP handler passes the worker's branch
- [ ] `worker-loop.ts`: verify → fix once → verify → continue or wait; self-check for each path
- [ ] Verify turns appear in the worker chat as their own divider ("Verify T123")
- [ ] Stub: a verify turn that reports a major finding the first time and nothing the second

**Out of scope:** verifying the whole branch at the end; changing R067's review UI.

## Files
- `src/lib/core.ts` — `getVerifyContext` ref
- `src/app/api/mcp/route.ts`
- `src/lib/worker-loop.ts`, `src/lib/worker-args.ts` (+ checks)
- `src/components/chat/ChatView.tsx`
- `e2e/fixtures/claude-stub/claude`, `e2e/worker-verify.mjs` — new

## Acceptance criteria
- [ ] A worker's verify context lists the commits on its branch, not main's (unit + e2e)
- [ ] Major finding → one fix turn with the findings, verify again, then the next task (S11)
- [ ] Major finding twice → the task is sent back and the worker waits on the user, no next task (S11)
- [ ] `workers.verify: false` → no verify turns
- [ ] `e2e/verification.mjs` still passes

## Verify
```bash
node src/lib/worker-loop.check.mts && node src/lib/verification.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-verify.mjs
BASE=http://localhost:3081 node e2e/verification.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S11 — WHEN a task finishes with critical or major verification findings → THEN the worker fixes them once in the same worktree, else waits on the user, and only then claims the next task
- [ ] Start a worker on an epic and let its first task finish → the worker chat shows a "Task T…" divider, then a "Verify T…" divider, then the next task's divider (when the review finds nothing critical or major)
- [ ] A review with a major finding → the chat shows a "Fix this verification finding: …" message, then a second "Verify T…" divider; the task's panel shows the new Verification block
- [ ] A second major finding on the same task → the task goes back to To do with a "changes requested" review entry naming the finding, the worker strip says Waiting on you, and no next task is claimed
- [ ] Set `"workers": { "verify": false }` in .vibedoc/settings.json, then Settings → Workers → Save → `verify: false` is still in the file, and a new worker runs tasks with no Verify dividers
### Regression risk
- [ ] A worker that asks a question (vibedoc_ask_questions) → answering it in the chat still resumes that task and the worker goes on
- [ ] The R067 Verify button on a done task (board panel) still opens a chat whose verify context lists the task's commits on the current branch
