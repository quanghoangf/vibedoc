# T558: Worker asks mid-task → needs you → resume
**Status:** 👀 Review
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T555
**Covers:** S3
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
When a worker needs a decision, its task stops and waits on the user (sidebar, header, inbox); the user's answer continues that task's session in the same worktree, and the loop goes on after.

> [!WARNING]
> Spike T566: resume with cwd = the worktree every time; `--resume` would also find the session from the main checkout and then edit there.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- Already there: MCP `vibedoc_ask_questions` (`src/lib/mcp-tools.ts:582`) shows a card and the agent ends its turn; `chatStatus()` (`src/lib/chats.ts:69`) gives `needs-answer`. A worker is a chat (T555), so the card shows already.
- `-p` has no `AskUserQuestion`: the worker's appended system prompt (one constant in `worker-args.ts`) says "to ask the user, call `vibedoc_ask_questions` and end your turn; never guess on a decision the task leaves open".
- T554's loop already stops on "exit 0, task still in-progress" (`wait-user`). Answering = `--resume <that task's sessionId>` with the worker argv (cwd = worktree), then back to the loop.
- Until T556, the turn result is written by the browser like any chat; T556 moves that to the server so the inbox is right with no tab open.
- The inbox (`src/lib/inbox.ts`, kind `chat-waiting`) reads saved chats; label worker rows "Worker · <branch> · <task>".

## Scope
- [ ] Worker system prompt constant with the ask rule
- [ ] Sending a message to a worker chat → `POST /api/workers/answer {id, message}` (resume that task's session, then continue the loop), never `/api/chat`
- [ ] Inbox label for worker rows
- [ ] Stub: a worker turn that calls `vibedoc_ask_questions` and exits with the task still in-progress; the answer turn finishes it

**Out of scope:** notifying the orchestrator (T562).

## Files
- `src/lib/worker-args.ts`, `src/lib/worker-loop.ts` (+ checks)
- `src/app/api/workers/answer/route.ts` — new
- `src/context/ChatContext.tsx` — route a worker chat's send
- `src/lib/inbox.ts` (+ check)
- `e2e/fixtures/claude-stub/claude`, `e2e/worker-ask.mjs` — new

## Acceptance criteria
- [ ] The stub asks → the worker shows "needs you", the header badge and `/inbox` count it, no next task claimed (S3)
- [ ] Answering → the next stub call has `--resume <that task's session>`, cwd = the worktree, and after it finishes the loop claims the next task (S3)
- [ ] A plain chat's send still goes to `/api/chat` (`e2e/chat-reload.mjs`)

## Verify
```bash
node src/lib/inbox.check.mts && node src/lib/worker-loop.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-ask.mjs
BASE=http://localhost:3081 node e2e/chat-reload.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S3 — WHEN the worker needs a decision mid-task → THEN the worker waits on the user, the inbox counts it, and the user's answer continues that task's session in the same worktree
- [ ] Start a real worker on an epic whose task leaves a decision open → its chat shows a question card, the strip reads "Waiting on you", and the header Inbox badge goes up by one
- [ ] Open /inbox → the row reads "Worker · vibedoc/<epic> · <task>" and opens the worker chat
- [ ] Pick an answer and press Submit → the card shows Answered, the answer appears as your message, and the worker runs again (strip reads "Working on <task>")
- [ ] After that task finishes → a "Task <next>" divider appears and the worker goes on to the next task; the code changes are in the worktree, not your checkout
- [ ] A worker that stopped mid-task without a question → a composer shows under its chat; typing a reply resumes the task
### Regression risk
- [ ] A plain agent chat (header Agent button) still sends, streams and answers its own question cards as before
