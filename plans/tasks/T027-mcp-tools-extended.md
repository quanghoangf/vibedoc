# T027 — Extended MCP Tools: Append, Rename, Delete
**Status:** ✅ Done
**Phase:** 3 — Doc Management
**Size:** S (1 hr)
**Depends on:** T021 (pattern for POST /api/docs is established)

## What to build
Round out the file management toolset with three new operations — append, rename, and delete — available both through the UI (context menu per file in DocList) and as MCP tools for AI agents. Agents need `append` to incrementally add notes to a doc without replacing its full content, and `rename`/`delete` to maintain a clean doc structure.

## Scope
- [ ] `appendDoc(docPath, content, root)` in `core.ts`
- [ ] `renameDoc(oldPath, newPath, root)` in `core.ts` (EXDEV-safe)
- [ ] `deleteDoc(docPath, root)` in `core.ts`
- [ ] `PATCH /api/docs` handler — rename; body `{ oldPath, newPath }`
- [ ] `DELETE /api/docs` handler — delete; body `{ path }`
- [ ] `...` hover button per file row in `DocList` → `DropdownMenu` with Rename and Delete
- [ ] Rename: opens inline editable input replacing the filename text; confirm on Enter
- [ ] Delete: `window.confirm()` → DELETE request → deselects doc if it was open
- [ ] MCP tools: `vibedoc_append_doc`, `vibedoc_rename_doc`, `vibedoc_delete_doc`
- [ ] Extend `ActivityEvent.type` union with `'doc_deleted'`

## Files to create
_(none — all changes go into existing files)_

## Files to modify
- `src/lib/core.ts` — add `appendDoc`, `renameDoc`, `deleteDoc`; extend `ActivityEvent.type`
- `src/app/api/docs/route.ts` — add `PATCH` and `DELETE` handlers
- `src/components/docs/DocList.tsx` — add `...` hover button + `DropdownMenu` per file row
- `src/app/(app)/docs/page.tsx` — handle `onDocRenamed` and `onDocDeleted` callbacks (refetch list, update selectedDoc)
- `src/app/api/mcp/route.ts` — add 3 new tools to `TOOLS` array and `handleTool` switch

## core.ts functions

```typescript
export async function appendDoc(docPath: string, content: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep)) throw new Error('Path outside root')
  let existing: string
  try { existing = await fs.readFile(fullPath, 'utf8') }
  catch { throw new Error(`Doc not found: ${docPath}`) }
  await fs.writeFile(fullPath, existing.trimEnd() + '\n\n' + content, 'utf8')
}

export async function renameDoc(oldPath: string, newPath: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullOld = path.resolve(root, oldPath)
  const fullNew = path.resolve(root, newPath)
  if (!fullOld.startsWith(resolvedRoot + path.sep)) throw new Error('Path outside root')
  if (!fullNew.startsWith(resolvedRoot + path.sep)) throw new Error('Path outside root')
  await fs.mkdir(path.dirname(fullNew), { recursive: true })
  try {
    await fs.rename(fullOld, fullNew)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
      // cross-device: copy then delete
      await fs.copyFile(fullOld, fullNew)
      await fs.unlink(fullOld)
    } else throw e
  }
}

export async function deleteDoc(docPath: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep)) throw new Error('Path outside root')
  await fs.unlink(fullPath)  // throws ENOENT if not found
  await appendActivity(root, { type: 'doc_deleted', actor: 'human', title: `Deleted ${docPath}` })
}
```

## API handlers
`PATCH /api/docs`:
```typescript
export async function PATCH(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const { oldPath, newPath } = await req.json()
  await renameDoc(oldPath, newPath, root)
  emitUpdate('doc_updated', { oldPath, newPath })
  return NextResponse.json({ ok: true })
}
```

`DELETE /api/docs`:
```typescript
export async function DELETE(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const { path: docPath } = await req.json()
  await deleteDoc(docPath, root)
  emitUpdate('doc_deleted', { path: docPath })
  return NextResponse.json({ ok: true })
}
```

## UI: context menu in DocList
Add a `...` button that appears on `hover` (`group-hover:opacity-100`) per file row. Uses `DropdownMenu` from shadcn (already installed):
- **Rename**: replaces filename text with an `<input>` pre-filled with current name; Enter confirms, Esc cancels; on confirm call `PATCH /api/docs`
- **Delete**: `window.confirm('Delete docs/foo.md?')` → if confirmed → `DELETE /api/docs` → on success call `onDocDeleted(path)` callback

## MCP tool schemas
`vibedoc_append_doc`: `{ path: string, content: string }` — appends to end of existing doc.
`vibedoc_rename_doc`: `{ oldPath: string, newPath: string }` — renames/moves.
`vibedoc_delete_doc`: `{ path: string }` — deletes. Returns confirmation string.

## Acceptance criteria
- [ ] Hovering a file row in DocList shows `...` button
- [ ] Clicking `...` opens dropdown with Rename and Delete options
- [ ] Rename: inline input appears, Enter saves with new name, file moves on disk, doc list refreshes
- [ ] Delete: confirmation dialog appears; confirming deletes file and removes from list; if file was open in editor, editor closes
- [ ] `vibedoc_append_doc` correctly appends with two newlines separator
- [ ] `vibedoc_rename_doc` works within the project root (cross-device safe)
- [ ] `vibedoc_delete_doc` confirms deletion in return message
- [ ] `pnpm build` passes

## Do NOT
- Don't allow rename/delete of files outside the project root (path traversal check is in core.ts)
- Don't skip the `window.confirm` on delete — no undo exists
- Don't add keyboard shortcut for delete without explicit confirmation

## Definition of done
Hover a doc in the list → `...` menu appears → can rename and delete. All 3 MCP tools callable by AI agent. `pnpm build` passes.
