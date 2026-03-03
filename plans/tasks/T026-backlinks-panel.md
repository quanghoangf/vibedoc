# T026 — Backlinks Panel
**Status:** 📋 Ready
**Phase:** 3 — Doc Management
**Size:** S (1 hr)
**Depends on:** —

## What to build
A "Referenced by" section at the bottom of the doc viewer showing which other docs link to the currently open file. This helps users understand doc relationships and navigate connected docs — essential for a well-organized doc system where architecture docs, runbooks, and API references cross-reference each other.

The panel is **lazy-loaded** (collapsed by default, fetched only when user expands it) to avoid scanning all docs on every page view.

## Scope
- [ ] `findBacklinks(targetPath, root)` in `core.ts` — scans all `.md` files for markdown links to the target
- [ ] `GET /api/backlinks?path=` route
- [ ] `BacklinksPanel` component — collapsible section below the editor
- [ ] Placed inside `DocViewer.tsx` below `MarkdownEditor`
- [ ] Lazy fetch: only runs when user clicks to expand the panel
- [ ] Clicking a backlink opens that doc in the editor (calls `onDocClick` or `openDoc` from context)
- [ ] Extend `vibedoc_read_doc` MCP tool to append backlinks to its return text (no new tool needed)

## Files to create
- `src/app/api/backlinks/route.ts`
- `src/components/docs/BacklinksPanel.tsx`

## Files to modify
- `src/lib/core.ts` — add `findBacklinks()`
- `src/components/docs/DocViewer.tsx` — render `<BacklinksPanel>` below the editor
- `src/app/api/mcp/route.ts` — update `vibedoc_read_doc` handler to call `findBacklinks` and append results

## core.ts: findBacklinks
```typescript
export async function findBacklinks(
  targetPath: string,
  root: string
): Promise<{ file: string; line: number; text: string }[]> {
  const files = await glob('**/*.md', {
    cwd: root,
    ignore: ['node_modules/**', '.git/**', '.next/**'],
    nodir: true
  })
  const normalTarget = targetPath.replace(/\\/g, '/')
  const basename = path.basename(normalTarget)
  const results: { file: string; line: number; text: string }[] = []

  for (const f of files) {
    // skip the file itself
    if (f.replace(/\\/g, '/') === normalTarget) continue
    try {
      const content = await fs.readFile(path.join(root, f), 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, i) => {
        // match markdown links: [text](path) containing the target filename or full path
        if (/\[.*\]\(.*\)/.test(line) &&
            (line.includes(basename) || line.includes(normalTarget))) {
          results.push({ file: f, line: i + 1, text: line.trim().slice(0, 120) })
        }
      })
    } catch { /* skip unreadable files */ }
  }
  return results
}
```

## API route: /api/backlinks
```typescript
// src/app/api/backlinks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { findBacklinks, getConfiguredRoot } from '@/lib/core'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const docPath = req.nextUrl.searchParams.get('path')
  if (!docPath) return NextResponse.json({ error: 'path required' }, { status: 400 })
  const links = await findBacklinks(docPath, root)
  return NextResponse.json({ links })
}
```

## BacklinksPanel component

```typescript
interface BacklinksPanelProps {
  docPath: string
  rootParam: string                          // e.g. "?root=/path"
  onOpenDoc: (path: string) => Promise<void> // opens another doc in editor
}
```

State:
- `expanded: boolean` — default `false`
- `links: { file, line, text }[]` — fetched on first expand
- `loading: boolean`

Behavior:
- Renders a collapsible row: `▶ Referenced by (N)` when collapsed, expands to show links list
- On first expand: `GET /api/backlinks?path=...&root=...` → sets `links`
- Subsequent toggles use cached `links` (no re-fetch)
- Each link: filename (bold) + line number (muted) + truncated link text
- Clicking a link calls `onOpenDoc(link.file)`
- Empty state: "No other docs link to this file."

## MCP integration: extend vibedoc_read_doc
In `mcp/route.ts`, after reading the doc content, call `findBacklinks(resolvedPath, root)` and append to the return text:
```
## Referenced by
- docs/architecture/HLD.md (line 42): [API Reference](../api-reference.md)
- CLAUDE.md (line 15): [see docs](docs/api-reference.md)
```
If no backlinks, don't append the section. This gives AI agents relationship context without a separate tool call.

## DocViewer integration
```typescript
// In DocViewer.tsx, below <MarkdownEditor>:
<BacklinksPanel
  docPath={doc.path}
  rootParam={rootParam}
  onOpenDoc={onOpenDoc}    // pass down from docs/page.tsx → DocsTab → DocViewer
/>
```
`onOpenDoc` wraps `openDoc` from AppContext.

## Acceptance criteria
- [ ] "Referenced by" section appears at the bottom of the doc viewer
- [ ] Section is collapsed by default (no API call on mount)
- [ ] Expanding the section fetches and displays backlinks
- [ ] Each backlink shows filename, line number, and the link text
- [ ] Clicking a backlink opens that doc in the editor
- [ ] Empty state shows "No other docs link to this file."
- [ ] `vibedoc_read_doc` MCP tool appends backlinks section to returned content
- [ ] `pnpm build` passes

## Do NOT
- Don't fetch backlinks on mount — lazy load only
- Don't re-fetch on every expand after the first load (cache the result in component state)
- Don't add a separate `vibedoc_find_backlinks` MCP tool — extend `vibedoc_read_doc` instead

## Definition of done
Open HLD.md → expand "Referenced by" at the bottom → see DOMAIN_MAP.md listed as a referencing file (since it links to HLD concepts) → click it → DOMAIN_MAP.md opens in editor. `pnpm build` passes.
