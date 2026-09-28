# T048: Task → sessions: "Sessions" section in task detail
**Status:** ✅ Done
**Phase:** R041 — Agent session timeline
**Size:** S
**Depends on:** T047

## Goal
From any task, the user can see which agent sessions touched it and jump to them.

## Context
- Epic: `plans/roadmap/R041-agent-session-timeline.md`
- Use `GET /api/sessions?taskId=` (T046) and the `SessionCard` rendering (T047).

## Scope
- [ ] Add a "Sessions" section to the task detail panel that lists the sessions touching this task (compact: time, actor, headline)
- [ ] Clicking a session switches to the Activity tab with that session scrolled into view and expanded
- [ ] If no session touched the task, show "No recorded sessions"

**Out of scope:** MCP (T049), docs (T050).

## Files
- The task detail component (find it under `src/components/board/`): add the section
- `src/components/activity/SessionTimeline.tsx`: accept a `focusSessionId` prop that scrolls to and expands that card
- `src/app/page.tsx`: wire the tab switch and the focus id

## Acceptance criteria
- [ ] The task detail lists the sessions that changed the task, newest first
- [ ] Clicking one opens Activity → Sessions with that card expanded and visible
- [ ] A task with no activity shows the empty text

## Verify
```bash
pnpm build && pnpm lint
# pnpm dev → open a task moved earlier → Sessions section → click → lands on the expanded card.
```
