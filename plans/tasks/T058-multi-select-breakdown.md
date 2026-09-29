# T058: "Break down epics…" multi-select from the roadmap
**Status:** 📋 Todo
**Phase:** R044 — Parallel agent chats
**Size:** M (2–3 hrs)
**Depends on:** T055

## Goal
From the roadmap, tick several epics and start one breakdown chat per epic in one click. They all run in parallel.

## Context
- Epic: `plans/roadmap/R044-parallel-agent-chats.md`
- T055 added `askAgent(message, { newChat: true })`, which always opens a new tab.
- The existing single-epic flow is in `src/components/roadmap/RoadmapItemSheet.tsx:136` (`Break down epic ${id} into tasks.`). Reuse the same message so the agent behaves the same.
- The roadmap map selects one node (`selectedId` in `RoadmapTab.tsx`). Decision: use a dialog with checkboxes, not multi-select on the canvas.
- Each chat is one `claude -p` process, so cap how many run at once.

## Scope
- [ ] A toolbar button "Break down epics…" in `RoadmapTab.tsx`, next to the existing "Plan from spec" button. Show it only when at least one epic is not done.
- [ ] New `BreakdownEpicsDialog.tsx`: lists epics that are not `done`, grouped by horizon. Epics with no linked tasks are listed first and pre-checked; epics that already have tasks are unchecked and marked "has N tasks".
- [ ] Confirm → one `askAgent(\`Break down epic ${id} into tasks.\`, { newChat: true })` per checked epic, then close the dialog.
- [ ] `MAX_RUNNING_CHATS = 4` in `src/lib/chats.ts`. The dialog disables Confirm above the free slots (4 minus the running chats) and says why. `routeAsk` refuses a new chat when the cap is reached, and the notice "Too many agents running (4). Close a tab or wait." shows.
- [ ] Add the cap refusal to `src/lib/chats.check.mts`.

**Out of scope:** shift-click multi-select on the map canvas and the timeline view, and queuing asks over the cap.

## Files
- `src/components/roadmap/BreakdownEpicsDialog.tsx`: new; follow `PlanFromSpecDialog.tsx` for dialog structure and styling.
- `src/components/roadmap/RoadmapTab.tsx`: button and dialog state.
- `src/lib/chats.ts`: `MAX_RUNNING_CHATS` and the cap in `routeAsk`.
- `src/lib/chats.check.mts`: the cap case.

## Implementation notes
- `routeAsk` lives in `ChatPanel`, but the dialog also needs the running count. Expose it with a tiny event or a context value instead of lifting all chat state. The cheapest way: `ChatPanel` publishes `runningCount` via a `useSyncExternalStore`-friendly module store in `chats.ts`, or the dialog lets `routeAsk` refuse and shows its notice. Choose one and keep it small.
- Epics = items with `parent` set. Task counts come from `item.tasks.length`. Done state comes from `item.status`.

## Acceptance criteria
- [ ] Tick 3 epics → Confirm → 3 new tabs, 3 `/api/chat` requests in flight at once, each message naming its own epic.
- [ ] With 3 chats running, the dialog allows only 1 more selection.
- [ ] Epics already broken down are unchecked by default and labeled.

## Verify
```bash
node src/lib/chats.check.mts
pnpm typecheck && pnpm build
```
