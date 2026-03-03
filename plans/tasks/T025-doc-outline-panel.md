# T025 — Doc Outline Panel
**Status:** 📋 Ready
**Phase:** 3 — Doc Management
**Size:** M (1.5–2 hrs)
**Depends on:** —

## What to build
A table-of-contents (TOC) panel that appears to the right of the editor when a doc is open. It shows all `#`, `##`, and `###` headings from the doc's current content. Clicking any heading scrolls to it in the preview pane. This is a critical navigation feature for long docs like architecture overviews, runbooks, and PRDs — essential for vibe coding sessions where you need to jump to a specific section quickly.

## Scope
- [ ] `extractHeadings(content)` pure function in `core.ts`
- [ ] `DocOutline` component — scrollable TOC panel
- [ ] Patch `MarkdownRenderer` to emit `id` attributes on headings (slug-based) so scroll-to works
- [ ] Add `onContentChange?: (content: string) => void` prop to `MarkdownEditor` — fires when content updates
- [ ] `DocsTab` tracks `liveContent` state, extracts headings, renders `DocOutline` as right panel
- [ ] Outline panel is hidden when no doc is selected
- [ ] Clicking a heading scrolls to it in the preview div via `document.getElementById(anchor).scrollIntoView()`

## Files to create
- `src/components/docs/DocOutline.tsx`

## Files to modify
- `src/lib/core.ts` — add `extractHeadings()` (pure function, no fs access)
- `src/components/docs/MarkdownRenderer.tsx` — patch `marked` heading renderer to add slug `id` attributes
- `src/components/docs/MarkdownEditor.tsx` — add `onContentChange` prop; call it when content changes
- `src/components/docs/DocsTab.tsx` — add `liveContent` state; pass `onContentChange` to MarkdownEditor; render `DocOutline`

## extractHeadings (pure function)
```typescript
export function extractHeadings(content: string): { level: number; text: string; anchor: string }[] {
  return content
    .split('\n')
    .filter(line => /^#{1,3} /.test(line))
    .map(line => {
      const match = line.match(/^(#{1,3}) (.+)/)!
      const text = match[2].trim()
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      return { level: match[1].length, text, anchor }
    })
}
```

## Marked heading renderer patch (in MarkdownRenderer.tsx)
Add once at module level (outside the component), using the same `marked.use()` pattern already in the file:
```typescript
marked.use({
  renderer: {
    heading({ text, depth }: { text: string; depth: number }) {
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      return `<h${depth} id="${anchor}">${text}</h${depth}>\n`
    }
  }
})
```
Use the same slug logic as `extractHeadings` so anchors match.

## MarkdownEditor: onContentChange prop
```typescript
interface MarkdownEditorProps {
  // ... existing props ...
  onContentChange?: (content: string) => void
}
```
Call `onContentChange(text)` inside the existing change handler (where `setSaveStatus('unsaved')` is called), debounced to 500ms to avoid flooding the parent with every keystroke.

## DocsTab layout changes
```typescript
// Before: DocList | DocViewer
// After:  DocList | DocViewer | DocOutline (when doc open)

const [liveContent, setLiveContent] = useState<string>('')

// When selectedDoc changes, sync liveContent:
useEffect(() => {
  setLiveContent(selectedDoc?.content ?? '')
}, [selectedDoc])

const headings = extractHeadings(liveContent)
```

Layout (flex row):
```
DocList   DocViewer + MarkdownEditor   DocOutline
w-64      flex-1                       w-48 (hidden when no doc)
```

## DocOutline component
```typescript
interface DocOutlineProps {
  headings: { level: number; text: string; anchor: string }[]
}
```

Renders a vertical list of heading entries:
- Level 1 (`#`): full width, `font-semibold text-sm`
- Level 2 (`##`): `pl-3 text-sm text-muted-foreground`
- Level 3 (`###`): `pl-6 text-xs text-muted-foreground`

Each entry is a `<button>` that calls:
```typescript
document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
```

Shows a "No headings" empty state when `headings.length === 0`.
Sticky header: "Outline" label with a `List` icon.

## Acceptance criteria
- [ ] Opening a doc with headings shows the Outline panel on the right
- [ ] All `#`, `##`, `###` headings appear in the panel, indented by level
- [ ] Clicking a heading scrolls the preview pane to that heading
- [ ] Outline updates as the user types (within 500ms)
- [ ] Outline panel is hidden when no doc is open
- [ ] Headings with special characters (backticks, parentheses) render correctly
- [ ] Opening a doc with no headings shows "No headings" empty state
- [ ] `pnpm build` passes with no TypeScript errors

## Do NOT
- Don't call `extractHeadings` on every keystroke — debounce to 500ms
- Don't re-register `marked.use()` inside the React component — call it once at module level
- Don't add scroll-to to the CodeMirror edit view for MVP — preview pane scroll is sufficient

## Definition of done
Open the HLD.md doc → Outline panel appears on the right with all section headings → click "Request flows" heading → preview scrolls to that section. Edit a heading → outline updates within 500ms. `pnpm build` passes.
