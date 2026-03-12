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

## MCP tool naming
All MCP tools are prefixed `vibedoc_`. Pattern: `vibedoc_[verb]_[noun]`.
Examples: `vibedoc_read_doc`, `vibedoc_update_task`, `vibedoc_log_decision`

When adding a new tool:
1. Add to the `TOOLS` array in `/api/mcp/route.ts`
2. Add a `case` in `handleTool()`
3. Document in `docs/architecture/03-services/mcp-server/TOOLS.md`
