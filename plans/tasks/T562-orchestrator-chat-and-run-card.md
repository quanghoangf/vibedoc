# T562: Orchestrator chat (optional overview)
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T561
**Covers:** S12

## Goal
Each project has one orchestrator chat that knows every worker: the user asks "who is working on what", or a fuzzy "do billing first, R110 after", and it answers from the live workers and proposes runs as the same run card. It is never on the path of the button.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007 ("the orchestrator is an optional chat")
- A chat with a fixed id (`ORCHESTRATOR_ID` in `src/lib/chats.ts`) per project, pinned at the top of the sidebar "Agents" and `/chat`; created on first open, can be cleared, not deleted.
- Its turns go through `/api/chat` with `orchestrator: true`: the chat argv (`--tools ''`, vibedoc MCP only) plus `vibedoc_list_workers` and `vibedoc_propose_run`, and its own appended prompt ("you never write code; read workers with list_workers; propose runs only with propose_run, then end your turn").
- A `propose_run` tool use renders as `RunCard` (T555/T561) in `ChatView`, like `PlanCard`; Accept = the same `POST /api/workers`; Reject → a note to the agent (`Chat.notes`).
- Worker → orchestrator: when a worker's phase changes to ended / wait-user / interrupted, the server adds a note to the orchestrator chat ("Worker vibedoc/R108: T557 waits on you"), so its next turn knows. No automatic orchestrator turn, so a busy orchestrator never blocks anything.

## Scope
- [ ] `ORCHESTRATOR_ID`, pinned sort (+ `chats.check.mts`)
- [ ] `/api/chat` orchestrator mode (tools + prompt)
- [ ] `RunCard` inside the chat for `propose_run`
- [ ] Worker phase change → note to the orchestrator chat (server-side, saved)
- [ ] An "Ask the orchestrator" entry in the sidebar Agents header
- [ ] Stub: an orchestrator turn that calls both tools

**Out of scope:** the orchestrator starting work on its own; orchestrators across projects.

## Files
- `src/app/api/chat/route.ts`, `src/context/ChatContext.tsx`, `src/components/chat/ChatView.tsx`, sidebar Agents
- `src/lib/chats.ts` (+ check), `src/lib/worker-loop.ts` (the note)
- `src/i18n/workers.ts`
- `e2e/orchestrator.mjs` — new

## Acceptance criteria
- [ ] Ask "who is working on what" (stub) → the reply is built from `vibedoc_list_workers` (S12)
- [ ] The stub's `propose_run` → a run card in the chat; Accept starts the worker exactly like the button
- [ ] A worker waiting on the user adds a note the orchestrator's next turn receives
- [ ] `e2e/i18n.mjs`, `e2e/chat-reload.mjs` still pass

## Verify
```bash
node src/lib/chats.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/orchestrator.mjs
BASE=http://localhost:3081 node e2e/chat-reload.mjs
```

## Manual tests
- [ ] S12 — WHEN the user asks the orchestrator chat who is working on what → THEN it answers from the live workers, and any run it suggests comes as the same run card
- [ ] With a real `claude`: "do R110 after R108 finishes" → it explains what it can and can't schedule and proposes a card for what it can
