# T023 — Context Bundler
**Status:** 📋 Ready
**Phase:** 3 — Doc Management
**Size:** M (1–2 hrs)
**Depends on:** T021 (DocList already modified; "Select" mode added alongside "New Doc" button)

## What to build
A multi-select mode in the DocList that lets users pick multiple docs, then copy all their contents as a single bundled "context block" to the clipboard. The context block is formatted so it can be pasted directly into an AI chat window as structured context. Also exposes this as a MCP tool so agents can bundle docs programmatically.

This is the core "vibe coding" workflow: select the docs that are relevant to the current task, copy the bundle, paste into Claude/Cursor/Windsurf as context.

## Scope
- [ ] `getContext(paths[], root)` in `core.ts` — reads N docs and concatenates them with separator headers
- [ ] `POST /api/context` route — accepts `{ paths: string[] }`, returns `{ context: string }`
- [ ] "Select" toggle button in DocList sidebar header (next to "New Doc")
- [ ] Multi-select mode: each file row shows a checkbox when select mode is active
- [ ] "Copy Context" button appears at the bottom of DocList when ≥1 doc is selected (shows count)
- [ ] Clicking "Copy Context" calls `POST /api/context` then writes to clipboard; shows brief "Copied!" status
- [ ] MCP tool `vibedoc_get_context`
- [ ] Select mode is scoped to flat list (not recursive tree) for MVP — show flat list automatically when in select mode

## Files to create
- `src/app/api/context/route.ts`

## Files to modify
- `src/lib/core.ts` — add `getContext()`
- `src/components/docs/DocList.tsx` — add selection mode (local state + SelectionContext)
- `src/app/api/mcp/route.ts` — add `vibedoc_get_context`

## core.ts: getContext
```typescript
export async function getContext(paths: string[], root: string): Promise<string> {
  const parts: string[] = []
  for (const p of paths) {
    try {
      const { content } = await readDoc(p, root)
      parts.push(`--- FILE: ${p} ---\n\n${content.trim()}`)
    } catch {
      // skip missing or unreadable files
    }
  }
  return parts.join('\n\n---\n\n')
}
```

## Context output format
```
--- FILE: CLAUDE.md ---

# VibeDoc — Agent Instructions
...

---

--- FILE: docs/architecture/HLD.md ---

# High-Level Design
...
```

## DocList selection mode
Use a React context **scoped to DocList** (defined in the same file, not exported) to avoid prop-drilling through the recursive `TreeNodeRow`:

```typescript
// Inside DocList.tsx (not exported)
const SelectionCtx = createContext<{
  active: boolean
  selected: Set<string>
  toggle: (path: string) => void
}>({ active: false, selected: new Set(), toggle: () => {} })
```

When `selectMode` is on:
- Switch from tree view to flat list (all docs sorted, no folder grouping)
- Each row shows a `Checkbox` (shadcn, already installed) before the filename
- Checking/unchecking calls `toggle(path)`
- Footer bar (fixed at bottom of DocList) shows: `{n} selected · Copy Context · Clear`

Exiting select mode clears the selection.

## Clipboard copy
```typescript
const handleCopyContext = async () => {
  const res = await fetch(`/api/context${rootParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: [...selected] })
  })
  const { context } = await res.json()
  await navigator.clipboard.writeText(context)
  setCopyStatus('copied')  // shows "Copied!" for 2s
  setTimeout(() => setCopyStatus('idle'), 2000)
}
```

## MCP tool: vibedoc_get_context
Input schema: `{ paths: string[] }` — array of relative doc paths.
Returns: the bundled context string. Useful for AI to load multiple docs at once before starting a task.

## Acceptance criteria
- [ ] "Select" button appears in DocList header
- [ ] Clicking "Select" switches to flat list with checkboxes
- [ ] Checking docs updates the selection counter in the footer
- [ ] "Copy Context" button appears in footer when ≥1 doc selected
- [ ] Clicking "Copy Context" copies the formatted bundle to clipboard and shows "Copied!" briefly
- [ ] Context block includes all selected docs with `--- FILE: path ---` separators
- [ ] `vibedoc_get_context` MCP tool returns the same format for given paths
- [ ] Clicking "Select" again (or "Clear") exits select mode and clears selection
- [ ] `pnpm build` passes

## Do NOT
- Don't implement tree-level multi-select for MVP — flat list is sufficient
- Don't download as a file — clipboard copy is the primary action
- Don't add a new npm dependency for checkboxes — shadcn Checkbox is already available

## Definition of done
Click "Select" → check CLAUDE.md and HLD.md → click "Copy Context" → paste into Claude chat → both docs appear formatted with headers. `pnpm build` passes.
