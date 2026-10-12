# T516: Visual blocks: compare and timeline
**Status:** 👀 Review
**Owner:** ai:claude
**Started:** 2026-10-12
**Done:** 2026-10-12
**Phase:** R096 — Visual docs
**Size:** M (2–3 hrs)
**Depends on:** T515
**Covers:** S3

## Goal
Two more visual blocks on the same comment-marker syntax: `<!-- vibedoc:compare -->` (2–3 items side by side, e.g. Option A vs B, each with its sub-bullets) and `<!-- vibedoc:timeline -->` (items whose title is a date or phase, drawn on a vertical rail).

## Context
- Epic: `plans/roadmap/R096-visual-docs.md`
- Extends T515's `src/lib/md-visual-blocks.ts` (`VISUAL_KINDS`, `splitItem`); reuse its item parsing.
- compare: each top-level item = one column (title, body, nested list as the column's points); more than 3 items → falls back to cards (note it in CONVENTIONS). Phones: columns stack.
- timeline: title = the date/phase label (mono, like dates elsewhere), body + detail beside it; a dot per item on a 1px rail, the accent only on an item whose title contains "now" (case-insensitive) — otherwise no accent (one accent rule).

## Scope
- [ ] compare + timeline renderers in `md-visual-blocks.ts` + check cases (column count, >3 fallback, nested points kept, timeline label/body split)
- [ ] `globals.css` for both, light + dark, 390px
- [ ] `e2e/visual-docs.mjs`: compare renders 2 columns side by side at 1400px and stacked at 390px; timeline renders N dots
- [ ] `docs/CONVENTIONS.md` "Visual blocks": add both

**Out of scope:** copy (T517), editor inserts (T518).

## Files
- `src/lib/md-visual-blocks.ts`, `src/lib/md-visual-blocks.check.mts`, `src/app/globals.css`, `e2e/visual-docs.mjs`, `docs/CONVENTIONS.md`

## Acceptance criteria
- [ ] A two-option compare and a four-step timeline render as described in light and dark; on GitHub both are plain lists
- [ ] Check + e2e pass; `pnpm build` ok, no new lint errors

## Verify
```bash
node src/lib/md-visual-blocks.check.mts
pnpm build && pnpm lint
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/visual-docs.mjs
```

## Manual tests
_Auto: `e2e/visual-docs.mjs` passed 2026-10-12 (items below marked [x] are what it proved). `md-visual-blocks` check, `pnpm build` ok._
### Steps
- [x] S3 — WHEN a doc has `<!-- vibedoc:compare -->` / `<!-- vibedoc:timeline -->` above a list → THEN VibeDoc shows columns / a timeline, and GitHub / `vibedoc_read_doc` still show the list
- [x] Compare at 390px → columns stack, nothing overflows
- [ ] Look at a compare and a timeline in light and dark → rail, dots and the Now accent read clearly (visual)
