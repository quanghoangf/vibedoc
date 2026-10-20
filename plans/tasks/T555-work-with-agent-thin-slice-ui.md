# T555: Thin slice UI: "Work with agent" → worker chat
**Status:** 📋 Todo
**Phase:** R108 — Agent runs in a worktree
**Size:** M (2–3 hrs)
**Depends on:** T554
**Covers:** S1, S2

## Goal
The user starts a worker from an epic's sheet, confirms branch and base, and watches it work task by task in a chat that shows its worktree, end to end for the first time.

## Context
- Epic: `plans/roadmap/R108-agent-runs-in-worktree.md`, ADR-007
- Entry point: the epic sheet's actions, next to its "Chat" button (`ItemActionsMenu` + the sheet's header in `components/roadmap/`).
- `RunCard` (`components/workers/RunCard.tsx`) is the one component for starting work: target, mode (new worktree / existing worker), branch, base, allowed tools and budget (read-only). It takes a proposal as props and returns the confirmed values via `onAccept`. Here it opens in a dialog with a proposal built client-side (always "new"); T561 replaces that with the server's proposal, T562 renders the same card inside the orchestrator chat.
- The worker is a chat: open it with `show(id)` from `ChatContext`. `ChatView` shows a `WorkerStrip` for `chat.worker` (branch, folder with copy, base, phase, current task) and one divider per task turn.
- Rules: i18n in `src/i18n/workers.ts` (`en` + typed `vi`), `useT()`; Tailwind only; no `localStorage`.

## Scope
- [ ] `RunCard` (+ a dialog wrapper)
- [ ] "Work with agent" on the epic sheet → dialog → `POST /api/workers` → open the worker chat
- [ ] `ChatContext`: follow a worker's stream; Stop = `POST /api/workers/cancel`
- [ ] `WorkerStrip`, per-task dividers in `ChatView`
- [ ] Sidebar "Agents" and `AgentMark` treat a worker like any chat attached to the epic
- [ ] Hidden in demo / playground (as Run/Verify are)

**Out of scope:** server-computed run cards and existing workers (T561); the orchestrator chat (T562); single tasks (T560); finish actions (T563, T564).

## Files
- `src/components/workers/RunCard.tsx`, `src/components/workers/WorkerStrip.tsx` — new
- `src/components/roadmap/*` — the sheet's action
- `src/context/ChatContext.tsx`, `src/components/chat/ChatView.tsx`
- `src/i18n/workers.ts`, `src/i18n/index.ts`
- `e2e/worker-run.mjs` — the browser path

## Acceptance criteria
- [ ] Epic sheet → Work with agent → Accept → the chat opens, streams, and shows branch + folder + the current task (S1)
- [ ] While the stub finishes a task, the board card moves without a reload, and the chat starts a new divider for the next task (S2)
- [ ] Reload during a task → the chat re-attaches
- [ ] `e2e/i18n.mjs` passes

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/worker-run.mjs
BASE=http://localhost:3081 node e2e/i18n.mjs
```

## Manual tests
- [ ] S1 — WHEN the user accepts a run card for a new worktree → THEN a new worktree and branch exist, the worker's commits land only there, and the user's checkout has no code changes
- [ ] S2 — WHEN the worker claims and finishes a task in the worktree → THEN the card moves on the board in real time, like a terminal session
