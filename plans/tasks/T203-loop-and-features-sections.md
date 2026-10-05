# T203: The loop + features sections
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** L (half day)
**Depends on:** T201

## Goal
A visitor understands what VibeDoc does in one glance: plan → build → prove → review, and the few features that make each step work.

## Context
- Epic: `plans/roadmap/R071-landing-page.md` ("the plan → build → prove → review loop in one visual").
- What each step is in the product: plan = roadmap + `/vibedoc:roadmap` / `/vibedoc:breakdown`; build = the agent claims tasks over MCP and the board moves live (`/vibedoc:work`); prove = Playwright evidence with screenshots and video per task; review = approve or send back, with verification findings. Wording for features can start from `src/app/welcome/page.tsx` and `PRODUCT.md`.
- Design: `DESIGN.md`. The loop is a drawn diagram (inline SVG or CSS), not stock icons in four boxes; no emoji.

## Design
- Approved design: `site/design/landing.dc.html` (direction "C · Lab notebook"; section map, tokens and motion in `site/design/README.md`; canvas https://claude.ai/artifact/MMDG5yHgf63oS2dUcLS6nQ). Match its layout, copy, sizes and motion; it is a reference, not code to copy into Astro as is.
- This task builds: the board screenshot in a browser frame with the two floating chips, "The loop" (four command cards with the line that draws itself on scroll), and the feature tour (pill tabs: Board, Roadmap, Evidence, Scenarios, Specs, Memory, Link graph, each with its text and screenshot). Screenshots are already in `site/public/screens/`.

## Scope
- [ ] Loop section: four steps in one visual, each with a one-line description and the command or screen it maps to
- [ ] Board screenshot in a browser frame, with the two floating chips (`vd-float`)
- [ ] Feature tour: accessible tabs (arrow keys) switching the text and the screenshot, 7 tabs as in the design, using `site/public/screens/*.jpg`; sections reveal on scroll (`vd-reveal`)
- [ ] Responsive: readable at 390px wide with no horizontal scroll
- [ ] Playwright: both sections render with their headings at phone and desktop widths

**Out of scope:** the demo video (T204), metrics or testimonials.

## Files
- `site/src/components/Loop.astro`, `site/src/components/Features.astro` — new
- `site/public/screens/*.png` — screenshots taken from the app (dark theme)
- `site/src/pages/index.astro`, `site/e2e/landing.spec.ts`

## Acceptance criteria
- [ ] The four loop steps appear in order with their descriptions
- [ ] Each of the 7 feature tabs shows its own title, text and screenshot; images have alt text
- [ ] No horizontal scroll at 390px (Playwright checks `scrollWidth <= clientWidth`)

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```
