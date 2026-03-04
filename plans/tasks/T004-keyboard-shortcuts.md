# T004: Keyboard Shortcuts
**Status:** ✅ Done
**Phase:** 1 — Polish
**Size:** S (1-2 hrs)
**Depends on:** T003

## What to build
Add keyboard shortcuts for fast navigation. Show a shortcuts reference modal with `?`.

## Shortcuts to implement
| Key | Action |
|-----|--------|
| `b` | Switch to Board tab |
| `d` | Switch to Docs tab |
| `a` | Switch to Activity tab |
| `m` | Switch to Memory tab |
| `?` | Toggle shortcuts help modal |
| `Escape` | Close panel / modal |
| `/` | Focus doc search (in Docs tab) |

## Files to touch
- `src/app/page.tsx` — add `useEffect` with `keydown` listener + help modal

## Implementation note
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // Don't fire when typing in input/textarea
    if (['INPUT','TEXTAREA'].includes((e.target as Element)?.tagName)) return
    switch(e.key) {
      case 'b': setActiveTab('board'); break
      case 'd': setActiveTab('docs'); break
      // ...
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

## Acceptance criteria
- [ ] `b`, `d`, `a`, `m` switch tabs
- [ ] `?` opens help modal listing all shortcuts
- [ ] `Escape` closes help modal (and task detail panel from T003)
- [ ] `/` focuses search input when in Docs tab
- [ ] Shortcuts don't fire when user is typing in an input or textarea
- [ ] Help modal shows shortcut key + description in a clean table
- [ ] `npm run build` passes

## Definition of done
Press `b` → Board tab. Press `?` → help modal. Press Escape → close. No regression on existing functionality.
