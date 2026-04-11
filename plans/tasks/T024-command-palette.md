# T024 — Command Palette (Cmd+K)
**Status:** ✅ Done
**Phase:** 3 — Doc Management
**Size:** M (1–2 hrs)
**Depends on:** —

## What to build
A keyboard-driven command palette opened with `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux). Type to search docs in real-time, navigate with arrow keys, and open any doc instantly without touching the mouse. Also provides quick actions (New Doc, go to Board, go to Memory) when the input is empty. Essential for power users and "vibe coding" flow where context-switching between docs should be instant.

## Scope
- [ ] `CommandPalette` component using existing shadcn `Dialog`
- [ ] `Cmd+K` / `Ctrl+K` keyboard shortcut in `layout.tsx` opens the palette
- [ ] Autofocused text input when palette opens
- [ ] Real-time doc search via existing `GET /api/docs?q=` (300ms debounce, ≥2 chars)
- [ ] Arrow Up/Down keyboard navigation through results
- [ ] Enter opens the selected doc (calls `openDoc()` from AppContext)
- [ ] Empty state: show quick actions list (New Doc, Go to Board, Go to Activity, Go to Memory)
- [ ] `Esc` closes (handled by Radix Dialog automatically)
- [ ] Integrate "New Doc" quick action with T021's modal (pass callback prop)

## Files to create
- `src/components/layout/CommandPalette.tsx`

## Files to modify
- `src/app/(app)/layout.tsx` — add `Cmd+K` keydown handler + `cmdOpen` state + render `<CommandPalette>`

## Component API
```typescript
interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenDoc: (path: string) => void   // from AppContext: openDoc
  onNewDoc?: () => void               // opens T021's NewDocModal
  rootParam: string                   // e.g. "?root=/path"
}
```

## Implementation details

### layout.tsx keydown handler
```typescript
const [cmdOpen, setCmdOpen] = useState(false)

// add to existing onKey / useEffect keydown handler:
if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
  e.preventDefault()
  setCmdOpen(v => !v)
}
```

### CommandPalette internals
```typescript
// State
const [query, setQuery] = useState('')
const [results, setResults] = useState<DocFile[]>([])
const [activeIndex, setActiveIndex] = useState(0)

// Search with debounce
useEffect(() => {
  if (query.length < 2) { setResults([]); return }
  const t = setTimeout(async () => {
    const res = await fetch(`/api/docs${rootParam}&q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setResults(data.results?.map((r: SearchResult) => ({ path: r.file, section: '', name: path.basename(r.file, '.md') })) ?? [])
    setActiveIndex(0)
  }, 300)
  return () => clearTimeout(t)
}, [query, rootParam])

// Keyboard navigation
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') setActiveIndex(i => Math.min(i + 1, results.length - 1))
  if (e.key === 'ArrowUp') setActiveIndex(i => Math.max(i - 1, 0))
  if (e.key === 'Enter') { handleSelect(results[activeIndex]); }
}
```

### Quick actions (shown when query is empty)
```typescript
const QUICK_ACTIONS = [
  { label: 'New Doc', icon: FilePlus, action: () => { onNewDoc?.(); onClose() } },
  { label: 'Go to Board', icon: Layout, action: () => { router.push('/board'); onClose() } },
  { label: 'Go to Activity', icon: Activity, action: () => { router.push('/activity'); onClose() } },
  { label: 'Go to Memory', icon: Brain, action: () => { router.push('/memory'); onClose() } },
]
```

### Radix Dialog setup
Use `Dialog` from `@/components/ui/dialog`. Pass `open={open}` and `onOpenChange={(v) => !v && onClose()}`. The Dialog already handles Esc key closure via Radix — no conflict with layout keydown because Radix stops propagation.

Reset `query`, `results`, and `activeIndex` to initial state when `open` changes to `false` (`useEffect` on `open`).

## UI layout
```
┌─ Dialog (max-w-lg, centered) ────────────────────────┐
│  🔍 [Search docs...                               ]   │
├───────────────────────────────────────────────────────┤
│  Results (scrollable, max-h-72):                      │
│  ▶ HLD.md           docs/architecture/               │
│    CLAUDE.md                                          │
│    API Reference    docs/                             │
│                                                       │
│  — or Quick Actions when empty —                      │
│  + New Doc                                            │
│  ⊞ Go to Board                                        │
└───────────────────────────────────────────────────────┘
```

Each result row: filename (bold) + section path (muted). Active row has a subtle background highlight (`bg-accent`). `activeIndex` updated on `mouseover` too.

## Acceptance criteria
- [ ] `Cmd+K` (Mac) and `Ctrl+K` (Windows) open the palette
- [ ] Input is autofocused when palette opens
- [ ] Typing ≥2 characters triggers a search after 300ms
- [ ] Results show doc name + path; active row is highlighted
- [ ] Arrow keys navigate the list
- [ ] Enter opens the selected doc and closes the palette
- [ ] Quick actions are shown when input is empty
- [ ] "New Doc" quick action opens the T021 NewDocModal (if available)
- [ ] `Esc` closes the palette
- [ ] Pressing `Cmd+K` while palette is open closes it (toggle)
- [ ] `pnpm build` passes

## Do NOT
- Don't add `cmdk` or any command palette library — use shadcn `Dialog` + plain input
- Don't trigger search for queries shorter than 2 characters (too noisy)

## Definition of done
Press Cmd+K → type "HLD" → see the HLD doc in results → press Enter → doc opens in editor. Press Esc → palette closes. `pnpm build` passes.
