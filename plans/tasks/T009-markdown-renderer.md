# T009: Fix markdown rendering — MarkdownRenderer with marked.parse (resolves T005)
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** S (30 min)
**Depends on:** T007, T008

## What to build
Replace the hand-rolled `renderMarkdown()` regex hack in page.tsx with a proper `MarkdownRenderer` component that uses `marked.parse()`.

## Scope
- [x] Create `src/components/docs/MarkdownRenderer.tsx`
- [x] Use `marked` (already in package.json) with GFM mode
- [x] Basic sanitization: remove `<script>` tags and event handlers
- [x] Wrap in `prose-dark` CSS class

## Acceptance criteria
- [x] Nested lists render correctly
- [x] Code blocks preserve indentation
- [x] Tables render properly
- [x] No XSS: `<script>` tags are stripped

## Definition of done
Open the DOMAIN_MAP.md doc in the viewer — table and heading all render correctly.
