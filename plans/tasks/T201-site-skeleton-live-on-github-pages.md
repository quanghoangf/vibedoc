# T201: Site skeleton live on GitHub Pages (Astro, hero, npx)
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
A real, small landing page is online at `https://quanghoangf.github.io/vibedoc/` with the headline and a copyable `npx vibedoc`, so every later task widens a live site instead of a local draft.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`. Decisions from the breakdown: a separate static site in `site/`, built with **Astro + Tailwind 4**, hosted on **GitHub Pages** (free subdomain for now; a custom domain comes later), thin page first then widen.
- Design language: `DESIGN.md` (Geist, Lab Violet accent, no generic AI gradients); the page uses the light "paper" palette listed in `site/design/README.md`. Copy those tokens into the site's CSS; don't import from `src/`.
- The in-app `/welcome` page (`src/app/welcome/page.tsx`, R042) stays as it is; its copy is a starting point for the headline.
- Project rules: Tailwind only, no CSS-in-JS (CLAUDE.md). The root app's `pnpm build`, `pnpm typecheck` and `pnpm lint` (`eslint src`) must not pick up `site/`.

## Design
- Approved design: `site/design/landing.dc.html` (direction "C · Lab notebook"; section map, tokens and motion in `site/design/README.md`; canvas https://claude.ai/artifact/MMDG5yHgf63oS2dUcLS6nQ). Match its layout, copy, sizes and motion; it is a reference, not code to copy into Astro as is.
- This task builds: the sticky header (logo, nav, GitHub button with icon; the live star count is T206), the hero (pill label with the pulsing dot, headline with the highlighted "proof", subhead, Watch it work / Star on GitHub buttons, "works with" line), the light paper theme with the 32 px grid, and the shared motion CSS.

## Scope
- [ ] `site/` as its own package (own `package.json` and lockfile, pnpm): Astro with the Tailwind 4 Vite plugin, `base: '/vibedoc'`, `site: 'https://quanghoangf.github.io'`
- [ ] Header and hero as in the design, on the paper background with the 32 px grid, plus a copy button for `npx vibedoc` that confirms "Copied" (T202 turns it into the tabs)
- [ ] Motion CSS in `site/src/styles/global.css`: `vd-in`, `vd-reveal` (scroll-driven, inside `@supports (animation-timeline: view())`), `vd-line`, `vd-float`, `vd-pulse`, all off under `prefers-reduced-motion`; the hero uses `vd-in` with staggered delays
- [ ] `.github/workflows/site.yml`: build `site/` and deploy to GitHub Pages on pushes to `main` that touch `site/**` (plus manual dispatch)
- [ ] Root `tsconfig.json` excludes `site`; root build/lint ignore it
- [ ] A Playwright check for this page (see Acceptance criteria) runnable against `astro preview`
- [ ] `site/README.md`: how to run, build and preview locally, and where it deploys

**Out of scope:** install tabs (T202), loop/features (T203), video (T204), live demo link (T205), stars/footer/SEO (T206), custom domain.

## Files
- `site/package.json`, `site/astro.config.mjs`, `site/src/pages/index.astro`, `site/src/styles/global.css`, `site/src/components/CopyCommand.astro` — new
- `site/e2e/landing.spec.ts` (+ `site/playwright.config.ts`, `webServer` = `astro preview`) — new
- `.github/workflows/site.yml` — new
- `tsconfig.json` — add `site` to `exclude`
- `site/README.md` — new

## Implementation notes
- GitHub Pages needs the repo's Pages source set to "GitHub Actions" once (Settings → Pages). That is a click for the human; say so in the report if it isn't set.
- Copy button: a tiny inline script using `navigator.clipboard.writeText`; keep the page working without JavaScript (the command is selectable text).
- Keep the copy component data-driven (`command`, `label`) so T202 can render a list of channels with it.

## Acceptance criteria
- [ ] `https://quanghoangf.github.io/vibedoc/` serves the page after the workflow runs on `main`
- [ ] Clicking copy puts exactly `npx vibedoc` on the clipboard and shows "Copied" (Playwright, clipboard permission granted)
- [ ] With reduced motion emulated, the hero is fully visible with no animation (Playwright `reducedMotion: 'reduce'`)
- [ ] The GitHub button links to the repo and its icon has no text alternative of its own (the button text names it)
- [ ] The page has one `h1`, a `<title>` and a meta description
- [ ] Root `pnpm typecheck && pnpm build && pnpm lint` still pass with `site/` present
- [ ] `site/README.md` explains run / build / deploy

## Verify
```bash
pnpm --dir site install && pnpm --dir site build && pnpm --dir site exec playwright test
pnpm typecheck && pnpm build && pnpm lint
curl -sI https://quanghoangf.github.io/vibedoc/ | head -1   # after the deploy: 200
```
