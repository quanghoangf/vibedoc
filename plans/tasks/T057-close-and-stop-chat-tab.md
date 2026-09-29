# T057: Close a tab and stop its running agent
**Status:** ✅ Done
**Phase:** R044 — Parallel agent chats
**Size:** S (~1 hr)
**Depends on:** T055

## Goal
Each chat tab has a close button that stops its running agent, so a breakdown you no longer need doesn't keep a `claude` process busy.

## Context
- Epic: `plans/roadmap/R044-parallel-agent-chats.md`
- Stopping already works on the server: `/api/chat` kills the child on request abort (`req.signal` → `child.kill('SIGTERM')`, `src/app/api/chat/route.ts`). The client only has to abort that chat's fetch (the per-chat `AbortController` from T055).

## Scope
- [ ] `closeChat(chats, id, activeId)` in `src/lib/chats.ts` → `{ chats, activeId }`. Closing the active tab activates its neighbor (right, else left). Closing the last tab leaves an empty chat list, and the panel shows today's empty state.
- [ ] Cases for `closeChat` in `src/lib/chats.check.mts`: close active / inactive / last.
- [ ] A × on each tab: it aborts the chat's controller if running, then removes the tab. If the tab has pending plan/edit cards, ask with `window.confirm` first ("Discard N unreviewed proposals?").

**Out of scope:** a separate Stop button that keeps the tab (close covers it), and undoing a close.

## Files
- `src/lib/chats.ts`: `closeChat`.
- `src/lib/chats.check.mts`: new cases.
- `src/components/chat/ChatPanel.tsx`: close button, abort, and confirm.

## Implementation notes
- The aborted stream's `catch` must not write into a chat that no longer exists: `patchChat` on a missing id is a no-op (make sure it is).
- Delete the controller from the per-chat map on close.

## Acceptance criteria
- [ ] Closing a running tab ends its `claude -p` process. Check with `pgrep -f "claude -p"`: the count drops by one within ~1s.
- [ ] Closing the active tab switches to a neighbor, and the other tabs keep streaming.
- [ ] Closing a tab with an unreviewed plan asks first, and Cancel keeps it.

## Verify
```bash
node src/lib/chats.check.mts
pnpm typecheck && pnpm build
# manual: start 2 breakdowns, `pgrep -fl "claude -p"`, close one tab, re-run pgrep
```
