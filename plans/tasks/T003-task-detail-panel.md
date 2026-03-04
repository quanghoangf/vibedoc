# T003: Task Detail Panel
**Status:** ✅ Done
**Phase:** 1 — Polish
**Size:** S (2-3 hrs)
**Depends on:** —

## What to build
Clicking a task card opens a slide-in right panel showing the full task file content — scope, acceptance criteria, definition of done. Panel slides in from the right without leaving the board view.

## Scope
- [ ] Slide-in panel component — fixed right side, 400px wide, slides in on task click
- [ ] Close on: X button, Escape key, click outside panel
- [ ] Content: render full task markdown (same prose-dark styles as doc viewer)
- [ ] Panel header: task ID + title + current status badge
- [ ] Quick status change buttons inside panel (same as hover actions)
- [ ] Panel state: `selectedTask: Task | null` in page state

## Files to touch
- `src/app/page.tsx` — add `TaskDetailPanel` component + selectedTask state

## Panel design
```
┌──────────────────────────────┐
│ T003 · in-progress      [×]  │  ← header
│ Task Detail Panel            │
├──────────────────────────────┤
│ [🔨 in-progress] [✅ done]   │  ← quick actions
│ [🚫 blocked]                 │
├──────────────────────────────┤
│  # T003: Title               │  ← full markdown render
│  **Phase:** ...              │     (scrollable)
│                              │
│  ## What to build            │
│  ...                         │
│                              │
│  ## Acceptance criteria      │
│  - [ ] ...                   │
└──────────────────────────────┘
```

## Acceptance criteria
- [ ] Click task card → panel slides in from right
- [ ] Full task markdown rendered with prose-dark styles
- [ ] Status change buttons work (same as hover quick actions)
- [ ] Escape key closes panel
- [ ] Click outside panel closes it
- [ ] Panel does not cover the full board (board still visible on left)
- [ ] `npm run build` passes

## Do NOT
- Don't navigate away from board — panel overlays it
- Don't rebuild markdown parser — reuse `renderMarkdown()` from page.tsx
- Don't add editing yet (that's T002 but for tasks — future task T009)

## Definition of done
Click any task card → side panel slides in with full content → status actions work → Escape closes it.
