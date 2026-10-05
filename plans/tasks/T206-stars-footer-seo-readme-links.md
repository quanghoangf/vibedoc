# T206: GitHub stars, footer, social preview/SEO, README + npm links
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** T201
**Covers:** S3

## Goal
The site looks finished wherever it shows up (search, X, Slack), every visitor finds the next step, and the README and npm page send people to the site.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`, scenario S3 (find the next step) and Done-when ("the README and the npm page link to the site").
- The docs site (R074) and changelog page (R075) don't exist yet: link the README docs section and `CHANGELOG.md` on GitHub for now, from one place (`site/src/data/links.ts`, created here if T205 hasn't).
- `package.json` `homepage` shows on the npm page at the next publish.

## Scope
- [ ] Header: GitHub link with the live star count (fetched from `api.github.com/repos/quanghoangf/vibedoc` in the browser; the link still works if the fetch fails)
- [ ] Footer: GitHub, docs, changelog, npm, license; links from `links.ts`
- [ ] Favicon + logo (from the app's logo tile, `DESIGN.md`), OpenGraph/Twitter image (1200×630, built once and committed), `og:` / `twitter:` meta, canonical URL, `sitemap.xml` and `robots.txt` (Astro sitemap integration)
- [ ] `README.md`: a "Website" link/badge at the top; `package.json`: `homepage` → `https://quanghoangf.github.io/vibedoc/`
- [ ] Playwright: footer links resolve (no 404 for internal ones), meta tags present, star count shows a number or falls back to "Star on GitHub"

**Out of scope:** the docs and changelog pages themselves (R074, R075), analytics (R077).

## Files
- `site/src/components/Header.astro`, `Footer.astro`, `site/src/layouts/Base.astro` (meta) — new
- `site/public/favicon.svg`, `og.png` — new
- `site/src/data/links.ts`, `site/astro.config.mjs` (sitemap), `site/e2e/landing.spec.ts`
- `README.md`, `package.json`

## Acceptance criteria
- [ ] Sharing the URL shows the OG image, title and description (meta tags checked by Playwright)
- [ ] The star count renders; with the GitHub API blocked the link still reads "Star on GitHub"
- [ ] README top and `package.json` `homepage` point to the site

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
grep -n '"homepage"' package.json && grep -n "quanghoangf.github.io/vibedoc" README.md
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] S3 — WHEN a visitor reaches the end of the page → THEN they can go to the docs, the changelog and the GitHub repo (with its star count)
