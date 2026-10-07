# T400: GFM alert callouts in the doc preview
**Status:** 📋 Todo
**Phase:** R089 — Richer markdown
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1

## Goal
`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` and `> [!CAUTION]` render as labelled callouts in every `MarkdownRenderer`, in light and dark, while the file stays plain GitHub markdown.

## Context
- Epic: `plans/roadmap/R089-richer-markdown.md`
- Decisions: GFM alerts only (no `:::` directives, no MDX). marked 18 does not render alerts itself (it emits a plain `<blockquote>` with `[!NOTE]` text), so this extension replaces that case.
- Colours from the theme tokens in `src/app/globals.css`, no new hue (DESIGN.md "Don't introduce a second accent"): NOTE = muted (`--color-muted` / `--color-border2`), TIP = teal, IMPORTANT = accent, WARNING = amber, CAUTION = danger. Tint via `color-mix(in srgb, <hue> 8–12%, transparent)`.
- The label ("Note", "Warning", …) stays English like GitHub's: it is produced by a pure lib inside `data-user-content` (skipped by `e2e/i18n.mjs`).
- CLAUDE.md: "Pure libs never import values from each other" (type imports only); "Never use a CSS-in-JS library — Tailwind only" (plain CSS in globals.css like the rest of `.prose-dark`).
- Keep the `MarkdownRenderer.tsx` change to one `marked.use(...)` line: R087 edits this file in parallel.

## Scope
- [ ] `src/lib/md-alerts.ts` (pure): `ALERT_KINDS`, `alertExtension` (a block-level marked extension; `start` on `> [!`, tokenizer matches a blockquote whose first line is exactly `[!KIND]`, case-insensitive, inner text lexed as blocks), renders `<div class="md-alert" data-alert="warning" role="note"><p class="md-alert-title">Warning</p>…</div>`
- [ ] `src/lib/md-alerts.check.mts`: each kind, lower-case kind, unknown kind stays a blockquote, text on the marker line stays a blockquote (GitHub rule), nested markdown inside (list, code) renders
- [ ] `MarkdownRenderer.tsx`: `marked.use({ extensions: [alertExtension] })`
- [ ] `globals.css`: `.prose-dark .md-alert` + one rule per `data-alert` (left border + tint + title colour), not italic
- [ ] `e2e/richer-markdown.mjs` (new): fixture doc with all five alerts; each renders `[data-alert=kind]` with its label; WARNING's border colour differs between light and dark (toggle `document.documentElement.classList` `dark`); no console errors

**Out of scope:** code tabs (T401), details (T402), toolbar (T403).

## Files
- `src/lib/md-alerts.ts`, `src/lib/md-alerts.check.mts` — new
- `src/components/docs/MarkdownRenderer.tsx` — one import + one `marked.use`
- `src/app/globals.css` — callout rules next to `.prose-dark blockquote`
- `e2e/richer-markdown.mjs` — new; copy fixture/launch pattern from `e2e/docs-links.mjs` (`makeFixture`, `stubChat(page, [], { root: fx })`, `/docs?doc=`)

## Implementation notes
- Custom extensions run before marked's built-in tokenizers, so the extension wins over blockquote. Strip `> ` per line, then `this.lexer.blockTokens(inner, [])`; renderer `this.parser.parse(tokens)`.
- Check imports `Marked` from `marked` (node_modules is fine for a check) and the lib with `.ts`.

## Acceptance criteria
- [ ] All five kinds render as callouts with their label; others stay blockquotes
- [ ] Light and dark both use the theme tokens (no hex)
- [ ] `node src/lib/md-alerts.check.mts` and `e2e/richer-markdown.mjs` pass

## Verify
```bash
node src/lib/md-alerts.check.mts
pnpm build && pnpm lint
PORT=3189 pnpm dev &   # then
BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/richer-markdown.mjs
```

## Manual tests
### Steps
- [ ] S1 — WHEN a doc contains `> [!WARNING]` followed by text → THEN VibeDoc renders a warning callout with its label, in light and dark themes
