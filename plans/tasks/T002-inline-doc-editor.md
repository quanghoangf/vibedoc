# T002: Inline Doc Editor
**Status:** ✅ Done
**Phase:** 1 — Polish
**Size:** M (3-5 hrs)
**Depends on:** —

## What to build
Add an edit mode to the doc viewer. Click "Edit" → textarea with raw markdown. Click "Save" → writes file back to disk via a new `PUT /api/docs` route.

## Scope
- [ ] Add `PUT /api/docs` route — accepts `{ path, content, root }`, writes file
- [ ] Add edit toggle button to doc viewer header ("Edit" / "Preview")
- [ ] Edit mode: full-height `<textarea>` with raw markdown content
- [ ] Save button: PUT to API, flash success, switch back to preview
- [ ] Cancel button: discard changes, back to preview
- [ ] Warn on unsaved changes if user tries to navigate away or click another doc
- [ ] Textarea styled with monospace font, dark theme, good line height

## Files to touch
- `src/app/api/docs/route.ts` — add PUT handler
- `src/lib/core.ts` — add `writeDoc(path, content, root)` function
- `src/app/page.tsx` — add edit mode state + textarea + save/cancel buttons

## core.ts function to add
```typescript
export async function writeDoc(docPath: string, content: string, root: string): Promise<void> {
  // Validate: path must be within root (no directory traversal)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(path.resolve(root))) throw new Error('Path outside root')
  await fs.writeFile(fullPath, content, 'utf8')
}
```

## Acceptance criteria
- [ ] "Edit" button appears on every doc in the viewer
- [ ] Edit mode shows textarea with current markdown content
- [ ] Save writes to file, preview updates immediately
- [ ] Cancel discards changes
- [ ] Path traversal rejected (security: can't write outside project root)
- [ ] `npm run build` passes

## Do NOT
- Don't add a WYSIWYG editor — plain textarea is correct for now
- Don't auto-save on every keystroke — explicit Save only
- Don't allow creating new files yet (edit only, not create)

## Definition of done
Open a doc → click Edit → modify text → click Save → file is updated on disk → preview shows new content.
