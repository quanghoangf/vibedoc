# T105: Preview card and Linked docs polish
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T104
**Done:** 2026-10-01

## Goal
The hover preview and the Linked docs column feel finished: readable preview text, one status language, accessible, consistent with DESIGN.md (critique P2 + minor observations).

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md`. Refs: `.claude/skills/impeccable/reference/polish.md`, `craft-floor.md`, DESIGN.md (Label Caps mono 10px 0.06em, StatusIcon/StatusChip, never show task emoji).
- Code: `src/components/docs/LinkPreview.tsx` (toPreview ~:40 strips every `_`; status emoji ~:160), `src/components/docs/LinkedDocs.tsx`, `src/components/docs/DocViewer.tsx` (header count ~:102).

## Scope
- [x] toPreview: strip only paired emphasis markers (`**x**`, `*x*`, `_x_` at word boundaries), keep `vibedoc_next_task`; drop task-list markers `[ ]`/`[x]`; inline code shown in mono.
- [x] Preview status: StatusIcon + label from STATUS_META (no emoji); owner chip if present.
- [x] Preview a11y: open on hover or `:focus-visible` only (not programmatic autofocus — fixes the instant pop when the mobile sheet opens); anchor gets `aria-describedby` while open; Esc closes it.
- [x] LinkedDocs: section labels as Label Caps (mono 10px, 0.06em); rows `transition-colors` on the fast token; "Linked from" citation shows the surrounding sentence/heading when the link text equals the path (from the source line, trimmed), else the line text.
- [x] DocViewer header count = unique linked files in + out (no double counting), broken shown separately as a small red count if > 0.
- [x] Sheet (below xl): duration/ease from motion tokens (open `--duration-slow`, close `--duration-base`, `--ease-out-soft`) — override only in this usage, not the shared ui/sheet defaults unless every sheet should change (check DESIGN.md: 260ms ceiling ⇒ change shared sheet if others also violate; note what you chose).

**Sheet choice:** changed the shared `ui/sheet.tsx` (open `--duration-slow`, close `--duration-base`, `--ease-out-soft`): every sheet (task panel, roadmap item, mobile sidebar, linked docs) used the off-token 500/300ms ease-in-out, so all of them now follow DESIGN.md.
**Citation data:** `extractLinks` now sets `context` (the sentence around a bare link, minus a leading `path:`; the heading above when the line is only the link) on links whose text equals the target; it flows through `DocEdge` → `LinkRow`.

**Out of scope:** card/preview enter/exit animation (T106).

## Acceptance criteria
- [x] Hovering a link to a doc mentioning `vibedoc_next_task` shows it intact; task previews show the StatusIcon, never ✅/📋.
- [x] Opening the Linked docs sheet on 390px doesn't pop a preview; Tab to a row does.
- [x] Section labels match Label Caps in DevTools; header count equals unique files.

## Verify
```bash
pnpm build && pnpm lint
# Playwright at 1440 and 390: hover preview text, sheet open, keyboard focus preview
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open docs/architecture/02-high-level-design/HLD.md on a wide window and hover the T034 row under Linked from → the card shows vibedoc_next_task with its underscores (in mono), a Done status chip with an icon, and no ✅/📋 emoji or [ ] boxes
- [ ] With the card open press Esc → the card closes; Tab onto another Linked docs row → its card opens
- [ ] Read the Linked from rows → each citation is the sentence around the link (e.g. "L20 · add vibedoc_next_task to the …"), not the HLD.md path again; section labels LINKS TO / LINKED FROM are small mono caps
- [ ] Look at the link button in the doc header → the number equals the distinct files listed across Links to and Linked from; open a doc with a broken link → a separate small red number shows next to it
- [ ] Narrow the window below 1280px (or use a phone) and tap the link button → the Linked docs sheet slides in quickly with no preview card popping; press Tab → the focused row's card appears; Esc closes the card first, a second Esc closes the sheet
### Regression risk
- [ ] Other sheets (board task panel, roadmap item sheet, mobile sidebar) still open and close, now faster (260ms in, 180ms out)
- [ ] Hover previews on links inside the rendered doc body still open, and the /graph page still loads
