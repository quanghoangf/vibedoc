# T047: Timeline view in the Activity tab — session cards with summary and links
**Status:** ✅ Done
**Phase:** R041 — Agent session timeline
**Size:** M
**Depends on:** T046

## Goal
The Activity tab shows a timeline of sessions. Each session is a card with who, when, how long, a headline, and clickable tasks, docs and ADRs. A user catches up in one read. This is the epic's "Done when".

## Context
- Epic: `plans/roadmap/R041-agent-session-timeline.md`
- Data comes from `GET /api/sessions` (T046). The main UI fetches data from API routes only. Refetch on the existing SSE update, the same way `ActivityTab` refreshes today.
- The existing components are `src/components/activity/ActivityTab.tsx`, `ActivityFeed` and `ActivityEventRow` (with `ACTIVITY_ICONS` and `timeAgo`).
- Tailwind only, dark theme, no `localStorage`.

## Scope
- [ ] Add a toggle in `ActivityTab`: **Sessions** (default) / **All events** (the existing feed)
- [ ] New `SessionTimeline` and `SessionCard` components
- [ ] Card header: actor icon (ai/human), relative start time, duration, event count
- [ ] Show the headline, then chips for tasks (with final status), docs and ADRs
- [ ] Clicking a task chip opens the task detail. Clicking a doc chip opens the doc in the docs viewer. Reuse the existing open-task and open-doc handlers
- [ ] Show a day separator ("Today", "Yesterday", date) between sessions
- [ ] Card expands to show the raw events of that session using `ActivityEventRow`
- [ ] Add an empty state

**Out of scope:** jumping from a task to its sessions (T048), MCP (T049), code diffs (R030), cost and tokens.

## Files
- `src/components/activity/SessionTimeline.tsx`: new
- `src/components/activity/SessionCard.tsx`: new
- `src/components/activity/ActivityTab.tsx`: add the toggle and fetch `/api/sessions`

## Implementation notes
- Pass the open handlers down from `page.tsx` the same way the existing activity rows or backlinks navigate. Find the current handler names there; don't add new global state.
- The expand state is local `useState` per card.

## Acceptance criteria
- [ ] With about a day of mixed activity, the Sessions view lists sessions newest-first with day separators and headlines
- [ ] Task, doc and ADR chips navigate to the right place
- [ ] Expanding a card shows exactly that session's events
- [ ] A new event arriving over SSE updates the top session without a page reload
- [ ] The All events toggle still shows the old feed

## Verify
```bash
pnpm build && pnpm lint
# pnpm dev → Activity tab: move tasks, create a doc, log an ADR via MCP; confirm one session card with the right headline and working chips.
```
