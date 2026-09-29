# T055: Parallel chats — tabs, a session per chat, new tab if busy
**Status:** 📋 Todo
**Phase:** R044 — Parallel agent chats
**Size:** L (half a day)
**Depends on:** —

## Goal
The chat sidebar holds several chats as tabs, each with its own Claude session and stream, so a second "Break down with agent" runs next to the first instead of being refused with "Agent is busy".

## Context
- Epic: `plans/roadmap/R044-parallel-agent-chats.md`
- The server is already parallel: `POST /api/chat` spawns one `claude -p` per request and keeps no state (`src/app/api/chat/route.ts`). All the single-chat limits are in `src/components/chat/ChatPanel.tsx`: one `messages`, one `sessionRef`, one `abortRef`, one `busy`, one `notesRef`.
- Decision: `askAgent()` reuses the active chat when it is idle and opens a new tab when it is running. `askAgent(msg, { newChat: true })` always opens a new tab (used by T058).
- Rules: never use `localStorage` (CLAUDE.md), so chats live in React state only and are gone on reload. Keep the 16 existing react-hooks lint errors from growing.

## Scope
- [ ] New pure module `src/lib/chats.ts`: the `Chat` type (`id`, `title`, `messages`, `sessionId`, `busy`, `notes`) and pure helpers: `addChat`, `patchChat(chats, id, fn)`, `routeAsk(chats, activeId, opts)` → `{ chatId } | { newChat: true }`, `chatTitle(firstMessage)` (e.g. "Break down R004", otherwise the first ~30 chars).
- [ ] `src/lib/chats.check.mts` covering `routeAsk` (idle active → reuse, busy active → new, `newChat` → new, no chats → new) and `chatTitle`.
- [ ] `ChatPanel.tsx`: replace the single-chat state with `chats` + `activeId`. Keep per-chat refs keyed by id (`Map<string, AbortController>`) for aborts. Change `send`, `handleEvent` and `patchLast` to take the chat id, so a background stream writes into its own chat, not the visible one.
- [ ] A tab strip under the header: one tab per chat (title, truncated), click to switch, plus the existing "New chat" (it now adds a tab instead of wiping).
- [ ] `ask-agent.ts`: `askAgent(message, opts?: { newChat?: boolean })`, carried in the event detail. `onAsk` uses `routeAsk`, so the "Agent is busy" notice goes away for asks.
- [ ] A project switch (`activeProject` effect) aborts every chat and clears all tabs, like today.
- [ ] Update `e2e/plan-buttons.mjs` case 2: a busy ask now opens a second tab and sends "again" (2 calls, the second with no `sessionId`). It is no longer refused.

**Out of scope:** status markers (T056), closing tabs (T057), multi-select breakdown (T058), a limit on open chats (T058).

## Files
- `src/lib/chats.ts`: new, pure (no React, no fs), so `node` can run the check.
- `src/lib/chats.check.mts`: new; copy the style of `src/lib/sessions.check.mts`.
- `src/components/chat/ChatPanel.tsx`: multi-chat state and tab strip.
- `src/lib/ask-agent.ts`: the `opts` param.
- `e2e/plan-buttons.mjs`: case 2.

## Implementation notes
- `handleEvent` currently closes over `patchLast`, which always patches the last message of *the* chat. Pass `chatId` in and use `setChats(cs => patchChat(cs, chatId, …))`. A stream must never read `activeId`.
- `sessionId` goes on the chat object: the first `session_id` in the stream sets it, and the next `send` for that chat passes it as `--resume`.
- `notesRef` (accept/reject notes for the agent) becomes per-chat `notes`. `resolvePlan` / `resolveProposal` / `answerQuestions` must target the chat that owns the card.
- The `onAsk` effect has no deps on purpose (see the comment at `ChatPanel.tsx:54`). Keep that pattern, or read state through a ref, so the handler sees the current `chats`.
- Cards already have unique ids (tool_use ids), so they need no renaming.

## Acceptance criteria
- [ ] Click "Break down with agent" on epic A, then on epic B while A is still "Thinking…". Two tabs appear, and both streams run at the same time (two `/api/chat` requests in flight).
- [ ] Switching tabs mid-stream shows each chat's own messages. Text from A never lands in B.
- [ ] A follow-up message in tab A resumes A's session (its `sessionId`), not B's.
- [ ] An ask while the active chat is idle still goes into that chat (today's single-chat flow is unchanged).
- [ ] `node src/lib/chats.check.mts` passes.

## Verify
```bash
node src/lib/chats.check.mts
pnpm typecheck && pnpm lint 2>&1 | tail -3   # no new errors beyond the 16 existing react-hooks ones
pnpm build
# dev server on :3000, then:
PW_DIR=<dir with playwright> node e2e/plan-buttons.mjs
PW_DIR=<dir with playwright> node e2e/stub-chat.mjs
PW_DIR=<dir with playwright> node e2e/ask-questions.mjs
```
