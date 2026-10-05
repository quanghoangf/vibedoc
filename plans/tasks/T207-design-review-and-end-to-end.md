# T207: Design review pass + S1–S3 end to end on the live URL
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** T202, T203, T204, T205, T206
**Covers:** S1, S2, S3

## Goal
The landing page is polished enough to be the project's front door, and the epic's three scenarios are proven on the deployed site, not only locally.

## Context
- Epic: `plans/roadmap/R071-landing-page.md` (Done when: README and npm link to the site; a visitor can copy an install command and open the live demo from the first screen).
- Design language and anti-patterns: `DESIGN.md` (Do / Don't), `PRODUCT.md`. The `impeccable` skill's critique is the review tool.
- This task only fixes what the review finds and checks the whole page; each section's own tests already landed with its task.

## Scope
- [ ] Critique the deployed page against `DESIGN.md`: hierarchy of the first screen, typography, spacing, contrast (WCAG AA), motion (respects reduced motion), phone (390px) and desktop; fix the findings
- [ ] Light theme too if the page offers it; otherwise dark only, stated in `site/README.md`
- [ ] A Playwright run against `https://quanghoangf.github.io/vibedoc/` covering S1–S3 in one pass (a separate project in `site/playwright.config.ts`, so local runs stay offline)
- [ ] Mark R071 done when every scenario passes (`vibedoc_update_roadmap_item`)

**Out of scope:** new sections, copy rewrites beyond what the review calls for.

## Files
- `site/src/**` — fixes from the review
- `site/playwright.config.ts` — `live` project with the public base URL
- `site/e2e/live.spec.ts` — new

## Acceptance criteria
- [ ] The critique's critical and major findings are fixed (list them in the report)
- [ ] `pnpm --dir site exec playwright test --project live` passes against the public URL
- [ ] R071's S1, S2 and S3 read passed on the epic sheet

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
pnpm --dir site exec playwright test --project live
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] S1 — WHEN a visitor picks an install tab (npx, npm, Homebrew, AI assistant) and clicks copy → THEN that exact command is on their clipboard and the button confirms it
- [ ] S2 — WHEN a visitor plays the demo video or opens the live demo → THEN they see an agent's task move across the board and the read-only demo opens without installing anything
- [ ] S3 — WHEN a visitor reaches the end of the page → THEN they can go to the docs, the changelog and the GitHub repo (with its star count)
