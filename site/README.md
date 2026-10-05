# VibeDoc landing page

The public site for VibeDoc (epic R071): https://quanghoangf.github.io/vibedoc/

Astro + Tailwind 4, its own package (not part of the app's build). The approved design and the section map are in
[`design/`](design/README.md).

```bash
pnpm install            # once, in site/
pnpm dev                # http://localhost:4321/vibedoc/
pnpm build              # static site in dist/
pnpm test               # builds, serves dist/ under /vibedoc (e2e/serve.mjs) and runs the Playwright checks
```

`pnpm test` needs Playwright's Chromium (`pnpm exec playwright install chromium` the first time).

**Deploy:** every push to `main` that touches `site/` runs `.github/workflows/site.yml`, which builds `dist/` and
publishes it to GitHub Pages (also runnable by hand from the Actions tab). The repo's Pages source must be set to
"GitHub Actions" once (Settings → Pages).

Paths: the site lives under `/vibedoc`, so links to files in `public/` use `import.meta.env.BASE_URL`.
