# T421: Sample GitHub Actions workflow + epic Done-when
**Status:** ✅ Done
**Phase:** R090 — Docs check in CI
**Size:** S (~1 hr)
**Depends on:** T420
**Covers:** S4

## Goal
Teams copy one workflow from the site docs and a PR that breaks a doc link fails.

## Context
- Epic: `plans/roadmap/R090-docs-check-cli.md`
- Site docs are Astro Starlight in `site/src/content/docs/docs/` (frontmatter `title` + `description`); the sidebar config is in `site/astro.config.*`.

## Scope
- [ ] New page `site/src/content/docs/docs/docs-check.md`: what `vibedoc check` checks, flags, exit codes, the workflow (`actions/checkout`, `actions/setup-node`, `npx -y vibedoc check`).
- [ ] Add it to the sidebar if the sidebar is listed by hand.
- [ ] Done-when: run the workflow's command on a temp clone with a broken link (fails) and fixed (passes) — covered by `bin/check.check.mts` driving `bin/vibedoc.mjs check` the way the workflow does.
- [ ] MEMORY.md R090 bullet; epic `**Status:** done`.

**Out of scope:** a reusable GitHub Action, annotations.

## Files
- `site/src/content/docs/docs/docs-check.md` — new
- `memory/MEMORY.md`, `plans/roadmap/R090-docs-check-cli.md`

## Acceptance criteria
- [ ] The page has a copyable workflow YAML that runs `npx vibedoc check`.
- [ ] `pnpm --dir site test` (or build) passes.

## Verify
```bash
pnpm --dir site test
node bin/check.check.mts
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [ ] S4 — WHEN a team copies the sample GitHub Actions workflow from the site docs → THEN a PR that breaks a doc link fails the job, and passes once the link is fixed
- [ ] `pnpm --dir site dev`, open /vibedoc/docs/docs-check/ → "Docs check in CI" is in the Start sidebar after Troubleshooting, with the rules table, exit codes and the workflow YAML
- [ ] Copy the YAML into a test repo after the next release, open a PR with a broken `[x](missing.md)` link → the "Docs check" job fails with the broken-link line; fix it → the job passes
### Regression risk
- [ ] The other Start pages (Troubleshooting, Privacy, Changelog) still show in the sidebar in the same order
