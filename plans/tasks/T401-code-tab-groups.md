# T401: Consecutive titled fences as code tabs
**Status:** ✅ Done
**Owner:** ai:claude
**Started:** 2026-10-07
**Done:** 2026-10-07
**Phase:** R089 — Richer markdown
**Size:** M (2–3 hrs)
**Depends on:** T400
**Covers:** S2

## Goal
Two or more fences in a row, each with `title="…"` in its info string (```` ```bash title="pnpm" ````), render as one block with a tab per fence, switchable by click and by arrow keys. On GitHub they read as plain consecutive code blocks.

## Context
- Epic: `plans/roadmap/R089-richer-markdown.md`
- marked keeps the whole info string in `token.lang` (`bash title="pnpm"`), and emits a `space` token between fences separated by a blank line.
- Grouping uses marked's `hooks.processAllTokens` (exists in marked 18): merge runs of ≥2 top-level `code` tokens that each have a title (skipping `space` tokens between them) into one `codegroup` token. Ceiling: top-level fences only (not inside lists/alerts) — mark it `ponytail:`.
- `sanitize()` in MarkdownRenderer strips `on*` attributes, so tab behaviour is a delegated click/keydown listener, not inline handlers. DocLinks only mounts with `docPath`, so the listener lives in its own small effect used by MarkdownRenderer for every renderer.
- Keep the MarkdownRenderer change small (R087 edits it too).

## Scope
- [ ] `src/lib/md-code-tabs.ts` (pure): `fenceTitle(lang)`, `groupFences(tokens)` (the processAllTokens hook), `codeTabsExtension` (renderer for `codegroup`: `<div class="md-code-group" data-code-group><div role="tablist">` buttons `role=tab` `aria-selected` `tabindex` 0/-1, then one `role=tabpanel` per fence, all but the first `hidden`; each panel's code goes through `this.parser.parse([codeToken])` with the title stripped from `lang`, so mermaid/highlight rules still apply)
- [ ] `src/lib/md-code-tabs.check.mts`: two titled fences → one group; blank line between still groups; a single titled fence or an untitled neighbour doesn't group; title is HTML-escaped
- [ ] `src/components/docs/code-tabs.ts`: `useCodeTabs(containerRef, html)` — click selects; ArrowLeft/Right wrap, Home/End; selected tab gets focus + `tabindex=0`; sets ids / `aria-controls` / `aria-labelledby`
- [ ] `MarkdownRenderer.tsx`: register the hook + extension, call `useCodeTabs`
- [ ] `globals.css`: tab strip (mono 11px labels, selected = accent underline, hover one tone up), panel `pre` without the outer double border
- [ ] `e2e/richer-markdown.mjs`: S2 section — pnpm/npm fences render one tablist with 2 tabs; click npm shows its code; ArrowLeft returns to pnpm with focus

**Out of scope:** syncing the chosen tab across groups or remembering it (no localStorage), grouping inside nested blocks.

## Files
- `src/lib/md-code-tabs.ts`, `src/lib/md-code-tabs.check.mts`, `src/components/docs/code-tabs.ts` — new
- `src/components/docs/MarkdownRenderer.tsx`, `src/app/globals.css`, `e2e/richer-markdown.mjs`

## Acceptance criteria
- [ ] pnpm/npm fences render as one block with two tabs; click and arrow keys switch; keyboard focus follows
- [ ] ARIA: `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`
- [ ] Plain fences render exactly as before
- [ ] `node src/lib/md-code-tabs.check.mts` and `e2e/richer-markdown.mjs` pass

## Verify
```bash
node src/lib/md-code-tabs.check.mts
pnpm build && pnpm lint
BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/richer-markdown.mjs
```

## Manual tests
_2026-10-07 — ai:claude_
### Steps
- [x] S2 — WHEN a doc has two fences in a row titled "pnpm" and "npm" → THEN they render as one block with two tabs, switchable by click and arrow keys
- [ ] In /docs, Tab into a code group → the selected tab shows the accent focus ring; Right/Left/Home/End move between tabs and the code under it changes
- [ ] Look at a code group in light and dark → tab strip, underline and code read clearly in both
- [ ] Edit the doc and type below a code group → the live preview keeps the group (it goes back to the first tab, by design)
### Regression risk
- [ ] A ```mermaid fence and a plain code block still render as before (diagram, plain pre)
