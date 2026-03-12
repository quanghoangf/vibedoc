# T021 — Doc Creation + Template Gallery
**Status:** ✅ Done
**Phase:** 3 — Doc Management
**Size:** M (2–3 hrs)
**Depends on:** —

## What to build
A "New Doc" button in the DocList sidebar that opens a 2-step modal: (1) pick a template from a gallery of 9 common vibe coding doc types, (2) confirm the file path. The file is created on disk and immediately opened in the editor. Also exposes this capability as two new MCP tools so AI agents can create docs from templates programmatically.

## Scope
- [ ] `POST /api/docs` handler (alongside existing GET and PUT in `docs/route.ts`)
- [ ] `createDoc(docPath, content, root)` in `core.ts` — errors with 409 if file already exists, creates parent dirs
- [ ] `src/lib/templates.ts` — hardcoded template registry (pure data, no fs imports)
- [ ] `NewDocModal` component — 2-step Dialog using existing shadcn `dialog.tsx`
- [ ] "New Doc" button (`+` icon) in `DocList` sidebar header
- [ ] Wire modal in `docs/page.tsx`: on success refetch doc list + open new doc in editor
- [ ] Emit `doc_created` SSE event after creation
- [ ] MCP tool `vibedoc_create_doc`
- [ ] MCP tool `vibedoc_list_templates`
- [ ] Extend `ActivityEvent.type` union with `'doc_created'`

## Templates (9)
| ID | Name | Default path |
|---|---|---|
| `claude-md` | CLAUDE.md | `CLAUDE.md` |
| `agents-md` | AGENTS.md | `AGENTS.md` |
| `prd` | Product Requirements Doc | `docs/prd.md` |
| `architecture-overview` | Architecture Overview | `docs/architecture/overview.md` |
| `api-reference` | API Reference | `docs/api-reference.md` |
| `runbook` | Runbook | `docs/runbook.md` |
| `adr` | Architecture Decision Record | `docs/architecture/decisions/ADR-001-title.md` |
| `meeting-notes` | Meeting Notes | `docs/meetings/YYYY-MM-DD.md` |
| `onboarding` | Onboarding Guide | `docs/onboarding.md` |

## NewDocModal flow
1. **Step 1:** Grid of template cards (icon + name + one-line description). User clicks to select, or clicks "Blank document". Selected card gets a ring highlight.
2. **Step 2:** Path input pre-filled with the template's `defaultPath`. User can edit it. "Create" button submits.
3. On submit: `POST /api/docs` with `{ path, content }` → on 201 close modal, call `onDocCreated(path)` → page refetches doc list + opens new doc.
4. On 409 (file exists): show inline error "A file already exists at this path."

## Files to create
- `src/lib/templates.ts`
- `src/components/docs/NewDocModal.tsx`

## Files to modify
- `src/lib/core.ts` — add `createDoc()`, extend `ActivityEvent.type`
- `src/app/api/docs/route.ts` — add `POST` handler
- `src/components/docs/DocList.tsx` — add "New Doc" `+` button in sidebar header
- `src/app/(app)/docs/page.tsx` — manage `newDocOpen` state, pass to DocList; handle `onDocCreated` callback; listen for `doc_created` SSE to refetch local docs list
- `src/app/api/mcp/route.ts` — add `vibedoc_create_doc` and `vibedoc_list_templates` tools

## core.ts: createDoc
```typescript
export async function createDoc(docPath: string, content: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep)) throw new Error('Path outside root')
  try {
    await fs.access(fullPath)
    throw Object.assign(new Error(`Doc already exists: ${docPath}`), { code: 'EEXIST' })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, 'utf8')
  await appendActivity(root, { type: 'doc_created', actor: 'human', title: `Created ${docPath}` })
}
```

## MCP tool schemas
`vibedoc_create_doc`:
```json
{ "path": "string (required)", "templateId": "string (optional)", "content": "string (optional)" }
```
Logic: if `templateId` → look up template content; if `content` → use directly; else blank. Calls `createDoc()`.

`vibedoc_list_templates`: no input. Returns formatted list of template IDs, names, default paths, and one-line descriptions.

## SSE / real-time
`docs/page.tsx` adds a listener to the global SSE stream for `doc_created` events (in addition to the existing context SSE handler). On event: re-call `GET /api/docs` to refresh local `docs` state.

## Acceptance criteria
- [ ] "New Doc" `+` button appears in DocList sidebar header
- [ ] Clicking opens the template gallery modal
- [ ] All 9 templates are shown with name and description
- [ ] Selecting a template and confirming path creates the file and opens it in the editor
- [ ] "Blank document" option creates an empty file
- [ ] If file already exists at path, modal shows inline error and does not close
- [ ] Created doc appears in the doc list without page refresh (SSE-driven)
- [ ] `vibedoc_create_doc` MCP tool works: AI can create docs with and without a templateId
- [ ] `vibedoc_list_templates` MCP tool returns all 9 templates
- [ ] `pnpm build` passes with no type errors (including ActivityEvent.type union)

## Do NOT
- Don't store templates on disk — they are hardcoded in `src/lib/templates.ts`
- Don't add a new npm package for the modal — reuse existing shadcn `Dialog`
- Don't skip the 409 conflict check — overwriting existing docs is destructive

## Definition of done
Click "New Doc" → pick "CLAUDE.md" template → path pre-filled → click Create → CLAUDE.md appears in editor with starter content. `pnpm build` passes.
