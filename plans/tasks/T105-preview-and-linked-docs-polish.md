# T105: Preview card and Linked docs polish
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T104

## Goal
The hover preview and the Linked docs column feel finished: readable preview text, one status language, accessible, consistent with DESIGN.md (critique P2 + minor observations).

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md`. Refs: `.claude/skills/impeccable/reference/polish.md`, `craft-floor.md`, DESIGN.md (Label Caps mono 10px 0.06em, StatusIcon/StatusChip, never show task emoji).
- Code: `src/components/docs/LinkPreview.tsx` (toPreview ~:40 strips every `_`; status emoji ~:160), `src/components/docs/LinkedDocs.tsx`, `src/components/docs/DocViewer.tsx` (header count ~:102).

## Scope
- [ ] toPreview: strip only paired emphasis markers (`**x**`, `*x*`, `_x_` at word boundaries), keep `vibedoc_next_task`; drop task-list markers `[ ]`/`[x]`; inline code shown in mono.
- [ ] Preview status: StatusIcon + label from STATUS_META (no emoji); owner chip if present.
- [ ] Preview a11y: open on hover or `:focus-visible` only (not programmatic autofocus — fixes the instant pop when the mobile sheet opens); anchor gets `aria-describedby` while open; Esc closes it.
- [ ] LinkedDocs: section labels as Label Caps (mono 10px, 0.06em); rows `transition-colors` on the fast token; "Linked from" citation shows the surrounding sentence/heading when the link text equals the path (from the source line, trimmed), else the line text.
- [ ] DocViewer header count = unique linked files in + out (no double counting), broken shown separately as a small red count if > 0.
- [ ] Sheet (below xl): duration/ease from motion tokens (open `--duration-slow`, close `--duration-base`, `--ease-out-soft`) — override only in this usage, not the shared ui/sheet defaults unless every sheet should change (check DESIGN.md: 260ms ceiling ⇒ change shared sheet if others also violate; note what you chose).

**Out of scope:** card/preview enter/exit animation (T106).

## Acceptance criteria
- [ ] Hovering a link to a doc mentioning `vibedoc_next_task` shows it intact; task previews show the StatusIcon, never ✅/📋.
- [ ] Opening the Linked docs sheet on 390px doesn't pop a preview; Tab to a row does.
- [ ] Section labels match Label Caps in DevTools; header count equals unique files.

## Verify
```bash
pnpm build && pnpm lint
# Playwright at 1440 and 390: hover preview text, sheet open, keyboard focus preview
```
