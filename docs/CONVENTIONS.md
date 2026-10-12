# Code Conventions
**Applies to:** All files in `src/`
**Last updated:** 2025-02-28

## File naming
| Type | Convention | Example |
|------|-----------|---------|
| API route | `src/app/api/[resource]/route.ts` | `api/tasks/route.ts` |
| Page | `src/app/[route]/page.tsx` | `app/page.tsx` |
| Lib module | `src/lib/[name].ts` | `lib/core.ts` |
| Component | PascalCase inline in page or `src/components/` | `TaskCard` |

## TypeScript patterns

### API routes — always validate + typed response
```typescript
// ✅ Type the request body, return typed JSON
export async function POST(req: NextRequest) {
  const { taskId, status } = await req.json() as { taskId: string; status: TaskStatus }
  const result = await updateTaskStatus(taskId, status, root)
  emitUpdate('task_updated', result)          // always emit after mutation
  return NextResponse.json(result)
}
```

### Core lib — pure functions, no side effects
```typescript
// ✅ core.ts functions only read/write files. No HTTP, no emitUpdate.
export async function updateTaskStatus(taskId: string, status: TaskStatus, root: string) { ... }

// ❌ Never do this in core.ts:
emitUpdate(...)        // belongs in API route
fetch(...)             // no HTTP calls from core
```

### Client components — fetch from own API
```typescript
// ✅ Always fetch from /api/* routes
const data = await fetch('/api/tasks?root=...').then(r => r.json())

// ❌ Never import from lib/core.ts in client components (server-only)
import { listTasks } from '@/lib/core'  // WRONG in client component
```

## SSE pattern — emit after every mutation
```typescript
// In API route after any write:
emitUpdate('task_updated', { taskId, status, task })
// The browser picks this up via /api/events and refreshes
```

## Styling
- **Tailwind utility classes only** — no inline `style={}` except for dynamic values
- **Color tokens from tailwind.config** — use `text-accent`, `bg-surface2`, `border-border` etc. Don't hardcode hex.
- **Dark theme only** — no light mode variants needed

## Visual blocks
Put `<!-- vibedoc:steps -->`, `<!-- vibedoc:cards -->`, `<!-- vibedoc:compare -->` or `<!-- vibedoc:timeline -->` on the line above a plain list (`-` or `1.`; a blank line between is fine). VibeDoc renders `steps` as numbered steps on a connecting rail, `cards` as a grid (one column on phones), `compare` as 2–3 columns side by side (each item's nested list = its points; stacked on phones; more than 3 items render as cards) and `timeline` as a vertical rail with a dot per item (the title is the date or phase label; only an item titled with the word "now" gets the accent). The marker is an HTML comment, so GitHub, `/md/<path>` and `vibedoc_read_doc` show the normal list.

```md
<!-- vibedoc:steps -->
1. **🎯 Focus** — One main goal at a time.
   Example: finish the transaction flow.
2. **Queue** — New asks go to a queue.
```

Each item: the leading **bold** is the title (a leading emoji in it becomes the icon), the rest of the first line the description, and the lines or paragraphs after it the muted detail. Links, code and `[[wikilinks]]` work inside. An unknown kind leaves the list as it is. Parsing: `src/lib/md-visual-blocks.ts`. Every visual on one page: [visual-showcase.md](visual-showcase.md).

## MCP tool naming
All MCP tools are prefixed `vibedoc_`. Pattern: `vibedoc_[verb]_[noun]`.
Examples: `vibedoc_read_doc`, `vibedoc_update_task`, `vibedoc_log_decision`

When adding a new tool:
1. Add to the `TOOLS` array in `/api/mcp/route.ts`
2. Add a `case` in `handleTool()`
3. Document in `docs/architecture/03-services/mcp-server/TOOLS.md`
