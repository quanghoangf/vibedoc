# T056: Status marker per chat tab
**Status:** ✅ Done
**Phase:** R044 — Parallel agent chats
**Size:** S (~1 hr)
**Depends on:** T055

## Goal
Each chat tab shows whether it is running, waiting for your answers, has a plan or edit to review, or is idle, so with three breakdowns running you know which tab needs you.

## Context
- Epic: `plans/roadmap/R044-parallel-agent-chats.md`
- T055 added `src/lib/chats.ts` (pure) and the tab strip in `ChatPanel.tsx`.
- The data is already on each chat: `busy`; unanswered `questions` on the last message (see `questionsPending` in `ChatPanel.tsx`); `plans` / `proposals` with `status: "pending"`.

## Scope
- [ ] `chatStatus(chat)` in `src/lib/chats.ts` → `'running' | 'needs-answer' | 'review' | 'idle' | 'error'`. Precedence: running > needs-answer > review > error > idle. `error` = the last assistant message has `error`.
- [ ] Cases for every status and the precedence in `src/lib/chats.check.mts`.
- [ ] Tab strip: a small dot or icon per status (spinner for running, amber for needs-answer, accent for review, red for error), with a `title` tooltip naming the status.
- [ ] The chat header "Agent" label shows a count when a *background* tab needs you (needs-answer or review), e.g. "Agent · 2", so you notice without switching tabs.

**Out of scope:** browser notifications or sounds, a status in the header's "Agent" toggle button when the sidebar is closed.

## Files
- `src/lib/chats.ts`: `chatStatus`.
- `src/lib/chats.check.mts`: new cases.
- `src/components/chat/ChatPanel.tsx`: tab strip markers and header count.

## Implementation notes
- Reuse the existing tokens (`text-amber`, `text-accent`, `text-red-400`) and `lucide-react` icons (`Loader2` is already used in `MCPSettings.tsx`). Merge classes with `cn()`.
- Keep `chatStatus` pure. Pass it the chat and nothing else, so the check file can build plain objects.

## Acceptance criteria
- [ ] While a breakdown runs, its tab shows running. When the agent asks its checkbox questions, the tab turns to needs-answer. After the plan card appears, it shows review.
- [ ] Accepting or rejecting every pending card in a tab returns it to idle.
- [ ] `node src/lib/chats.check.mts` passes with the new cases.

## Verify
```bash
node src/lib/chats.check.mts
pnpm typecheck && pnpm build
```
