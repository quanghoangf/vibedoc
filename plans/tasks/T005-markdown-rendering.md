# T005: Proper Markdown Rendering
**Status:** 📋 Ready
**Phase:** 1 — Polish
**Size:** S (1-2 hrs)
**Depends on:** —

## What to build
Replace the hand-rolled regex markdown renderer in `page.tsx` with `marked` (already in package.json). Add proper sanitization to prevent XSS.

## Problem
Current `renderMarkdown()` in `page.tsx` is a regex hack. It breaks on:
- Nested lists
- Code blocks with special characters
- Tables with complex content
- Inline HTML
- Edge cases in headings

## Scope
- [ ] Replace `renderMarkdown()` with `marked.parse()`
- [ ] Add DOMPurify or basic sanitization (strip `<script>`, `onerror=`, etc.)
- [ ] Keep the same `prose-dark` CSS class for styling
- [ ] Test against CLAUDE.md, HLD.md, and a task file

## Implementation
```typescript
import { marked } from 'marked'

// Configure marked
marked.setOptions({
  gfm: true,      // GitHub Flavored Markdown (tables, strikethrough)
  breaks: false,
})

function renderMarkdown(md: string): string {
  const html = marked.parse(md) as string
  // Basic sanitization — remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
}
```

## Acceptance criteria
- [ ] Nested lists render correctly
- [ ] Code blocks preserve indentation and special characters
- [ ] Tables render with all columns
- [ ] `**bold**` and `*italic*` work everywhere
- [ ] No `<script>` tags survive in output
- [ ] Existing prose-dark styles still apply
- [ ] `npm run build` passes

## Do NOT
- Don't add `dompurify` as a new package — basic regex sanitization is sufficient for local tool
- Don't change the prose-dark CSS classes

## Definition of done
Open the VibeDoc README doc → everything renders correctly including the nested lists and code blocks.
