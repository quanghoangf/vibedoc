# T402: `<details>` styled as an accordion
**Status:** 📋 Todo
**Phase:** R089 — Richer markdown
**Size:** S (~1 hr)
**Depends on:** T400
**Covers:** S3

## Goal
`<details><summary>More</summary>…</details>` renders collapsed with a styled summary row (chevron, hover, focus ring) that opens on click, same as GitHub.

## Context
- Epic: `plans/roadmap/R089-richer-markdown.md`
- marked passes the HTML block through and `sanitize()` keeps `<details>`; markdown inside needs a blank line after `<summary>` (GitHub's rule too). So this is CSS only.
- Theme tokens only; chevron via `summary::before`, turned 90° on `[open]`, `--duration-fast` transition (the global reduced-motion rule turns it off).

## Scope
- [ ] `globals.css`: `.prose-dark details` (border, radius 8px, surface), `summary` (list-style none, marker hidden incl. `::-webkit-details-marker`, cursor pointer, hover tone up, `:focus-visible` accent ring), open body padding
- [ ] `e2e/richer-markdown.mjs`: S3 section — details is closed, body hidden; click summary → open, body visible; markdown inside (a list) rendered

**Out of scope:** an "expand all" control, toolbar insert (T403).

## Files
- `src/app/globals.css`, `e2e/richer-markdown.mjs`

## Acceptance criteria
- [ ] Collapsed by default, opens on click and with Enter/Space from the keyboard
- [ ] Styled in light and dark from tokens
- [ ] `e2e/richer-markdown.mjs` passes

## Verify
```bash
pnpm build && pnpm lint
BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/richer-markdown.mjs
```

## Manual tests
### Steps
- [ ] S3 — WHEN a doc contains `<details><summary>More</summary>…</details>` → THEN it renders collapsed with a styled summary row that opens on click
