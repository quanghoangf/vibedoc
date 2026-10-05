# T201: Site skeleton live on GitHub Pages (Astro, hero, npx)
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
A real, small landing page is online at `https://quanghoangf.github.io/vibedoc/` with the headline and a copyable `npx vibedoc`, so every later task widens a live site instead of a local draft.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`. Decisions from the breakdown: a separate static site in `site/`, built with **Astro + Tailwind 4**, hosted on **GitHub Pages** (free subdomain for now; a custom domain comes later), thin page first then widen.
- Design language: `DESIGN.md` (Geist, dark-first tokens, Lab Violet accent, no generic AI gradients). The app's tokens live in `src/app/globals.css` (`@theme inline` + `--rgb-*`); copy the colour and font tokens into the site's CSS, don't import from `src/`.
- The in-app `/welcome` page (`src/app/welcome/page.tsx`, R042) stays as it is; its copy is a starting point for the headline.
- Project rules: Tailwind only, no CSS-in-JS (CLAUDE.md). The root app's `pnpm build`, `pnpm typecheck` and `pnpm lint` (`eslint src`) must not pick up `site/`.

## Scope
- [ ] `site/` as its own package (own `package.json` and lockfile, pnpm): Astro with the Tailwind 4 Vite plugin, `base: '/vibedoc'`, `site: 'https://quanghoangf.github.io'`
- [ ] One page: VibeDoc name, headline + one-line subhead, a copy button for `npx vibedoc` that confirms "Copied", dark background, Geist
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
- [ ] The page has one `h1`, a `<title>` and a meta description
- [ ] Root `pnpm typecheck && pnpm build && pnpm lint` still pass with `site/` present
- [ ] `site/README.md` explains run / build / deploy

## Verify
```bash
pnpm --dir site install && pnpm --dir site build && pnpm --dir site exec playwright test
pnpm typecheck && pnpm build && pnpm lint
curl -sI https://quanghoangf.github.io/vibedoc/ | head -1   # after the deploy: 200
```
