# T012: Extract activity + memory components
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** S (1 hr)
**Depends on:** T008, T009

## What to build
Extract the activity feed and memory tab into dedicated components.

## Scope
- [x] Create `src/components/activity/ActivityEventRow.tsx` — single event with ACTIVITY_ICONS + timeAgo
- [x] Create `src/components/activity/ActivityFeed.tsx` — timeline with vertical line
- [x] Create `src/components/activity/ActivityTab.tsx` — heading + live dot + feed or empty state
- [x] Create `src/components/memory/MemoryTab.tsx` — MarkdownRenderer + CLAUDE.md hint block

## Acceptance criteria
- [x] Activity tab shows timeline of events
- [x] Memory tab renders MEMORY.md with proper markdown

## Definition of done
Activity tab shows events, Memory tab renders markdown content.
