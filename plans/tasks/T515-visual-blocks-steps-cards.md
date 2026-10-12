# T515: Visual blocks: steps and cards
**Status:** 📋 Todo
**Phase:** R096 — Visual docs
**Size:** L (half a day)
**Covers:** S3

## Goal
A plain markdown list marked with `<!-- vibedoc:steps -->` or `<!-- vibedoc:cards -->` renders as ChatGPT-style visuals: `steps` = stacked cards joined by down arrows, `cards` = a responsive grid of cards. GitHub, the raw `/md/` view and `vibedoc_read_doc` still show the normal list, because the marker is an HTML comment.

## Context
- Epic: `plans/roadmap/R096-visual-docs.md` (the syntax decision: comment marker on a plain list, not a fence, not MDX — same reasoning as R089 and R087's audience comments)
- Syntax:
  ```md
  <!-- vibedoc:steps -->
  1. **Focus** — One main goal at a time.
     Example: finish the transaction flow.
  2. **Queue** — New asks go to a queue.
  ```
  Item = leading **bold** = title, the rest of the first paragraph = description, following lines/paragraphs = detail (muted); optional leading emoji in the title stays as its icon. Works with `-` or `1.` lists.
- Pattern to copy: `groupFences` in `src/lib/md-code-tabs.ts` (marked `hooks.processAllTokens` merging tokens into a custom token + an extension renderer). marked emits the comment as an `html` token followed by (maybe a `space`, then) a `list` token.
- Item text goes through `this.parser.parseInline` / `parse` so links, code and wikilinks still work. `sanitize()` stays.
- `forAgent()` (`src/lib/audience.ts`) must keep the marker comment untouched (it only handles agent-only / human-only).
- Style: DESIGN.md tokens; cards = surface + 1px rule line, 6px radius like `.md-alert`; arrows = lucide-style inline SVG, Pencil Grey; no shadows. Phones: one column.

## Scope
- [ ] `src/lib/md-visual-blocks.ts` (pure): `VISUAL_KINDS = ["steps","cards","compare","timeline"]` (only steps/cards render here; unknown/unsupported kinds leave the list untouched), `groupVisualBlocks(tokens)` hook, `visualBlocksExtension` renderer → `<div class="md-visual" data-visual="steps">` with `<ol|ul role="list">` items (keep list semantics for screen readers), `splitItem(item)` → `{ icon?, title, body, detail }`
- [ ] `.check.mts`: marker + list → one block; blank line between marker and list still groups; marker with no list → nothing; unknown kind → plain list; title/body split; HTML escaped
- [ ] `MarkdownRenderer.tsx` registers it (next to the code-tabs hook; both run in one `processAllTokens` — chain them)
- [ ] `globals.css` for `.md-visual[data-visual=steps|cards]`, light + dark, 390px
- [ ] `e2e/visual-docs.mjs`: S3 section — a steps block renders N cards with N−1 arrows, a cards block a grid; `GET /md/<path>` still contains the plain list and the comment
- [ ] Document the syntax in `docs/CONVENTIONS.md` (short section "Visual blocks")

**Out of scope:** compare + timeline (T516), copy (T517), editor inserts (T518).

## Files
- `src/lib/md-visual-blocks.ts`, `src/lib/md-visual-blocks.check.mts` — new
- `src/components/docs/MarkdownRenderer.tsx`, `src/app/globals.css`, `e2e/visual-docs.mjs`, `docs/CONVENTIONS.md`

## Acceptance criteria
- [ ] The example above renders as three-style cards with arrows in /docs, light and dark, and in the editor's live preview
- [ ] The same file on GitHub (`gh api /markdown`, skipped when gh isn't logged in) and via `/md/<path>` is a normal numbered list
- [ ] Lists without a marker render exactly as before
- [ ] Check + e2e pass; `pnpm build` ok, no new lint errors

## Verify
```bash
node src/lib/md-visual-blocks.check.mts
pnpm build && pnpm lint
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/visual-docs.mjs
```

## Manual tests
### Steps
- [ ] S3 — WHEN a doc has `<!-- vibedoc:steps -->` above a numbered list of bold titles with text → THEN VibeDoc shows one card per item joined by arrows, and GitHub / `vibedoc_read_doc` still show the numbered list
- [ ] Cards block at 390px → one column, no horizontal scroll
### Regression risk
- [ ] Task checklists (`- [ ]`) and nested lists render as before
