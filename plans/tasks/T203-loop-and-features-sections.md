# T203: The loop + features sections
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** T201

## Goal
A visitor understands what VibeDoc does in one glance: plan → build → prove → review, and the few features that make each step work.

## Context
- Epic: `plans/roadmap/R071-landing-page.md` ("the plan → build → prove → review loop in one visual").
- What each step is in the product: plan = roadmap + `/vibedoc:roadmap` / `/vibedoc:breakdown`; build = the agent claims tasks over MCP and the board moves live (`/vibedoc:work`); prove = Playwright evidence with screenshots and video per task; review = approve or send back, with verification findings. Wording for features can start from `src/app/welcome/page.tsx` and `PRODUCT.md`.
- Design: `DESIGN.md`. The loop is a drawn diagram (inline SVG or CSS), not stock icons in four boxes; no emoji.

## Scope
- [ ] Loop section: four steps in one visual, each with a one-line description and the command or screen it maps to
- [ ] Features section: 4–6 items (live board + MCP, roadmap, memory, evidence & review, agent chat, local-first files), each a short title + one sentence, with a real UI screenshot where it helps (screenshots in `site/public/`)
- [ ] Responsive: readable at 390px wide with no horizontal scroll
- [ ] Playwright: both sections render with their headings at phone and desktop widths

**Out of scope:** the demo video (T204), metrics or testimonials.

## Files
- `site/src/components/Loop.astro`, `site/src/components/Features.astro` — new
- `site/public/screens/*.png` — screenshots taken from the app (dark theme)
- `site/src/pages/index.astro`, `site/e2e/landing.spec.ts`

## Acceptance criteria
- [ ] The four loop steps appear in order with their descriptions
- [ ] Every feature has a title and one sentence; images have alt text
- [ ] No horizontal scroll at 390px (Playwright checks `scrollWidth <= clientWidth`)

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```
