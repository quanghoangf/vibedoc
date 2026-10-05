# T212: Changelog page from CHANGELOG.md
**Status:** 👀 Review
**Phase:** R075 — Changelog & release notes
**Size:** M (2–3 hrs)
**Depends on:** —
**Owner:** ai:claude-code
**Started:** 2026-10-05

## Goal
Visitors see what changed in each release in plain words, newest first, at `/vibedoc/changelog/`, so the project looks alive and users know when to update.

## Context
- Epic: `plans/roadmap/R075-changelog-release-notes.md`.
- Decision: a landing-style page (own route, the landing page's layout), generated at build time from `CHANGELOG.md`, which semantic-release already writes at every release (`# [x.y.0]` minor / `## [x.y.z]` patch headings, `### Features` / `### Bug Fixes` groups, `* **scope:** text (T123) ([sha](url))` items).
- The release commit carries `[skip ci]`, so release.yml dispatches `site.yml` itself after a new version (`actions: write`).

## Scope
- [ ] Pure parser `site/src/lib/changelog.ts` (+ `changelog.check.mts`): releases with version, date, compare link, groups New (Features) / Fixed (Bug Fixes) / Improved (anything else), items with scope and text (task ids and commit hashes dropped from the text, the commit kept as a link)
- [ ] `site/src/pages/changelog.astro`: newest first, a short jump list of versions, each release linkable (`#v1.14.0`)
- [ ] Links: footer and header Changelog → the page (`CHANGELOG` in `links.ts`), docs sidebar, GitHub release notes end with a link to it (`releaseBodyTemplate`)
- [ ] The site rebuilds after every release (release.yml dispatches `site.yml`; `site.yml` also triggers on `CHANGELOG.md`)

**Out of scope:** a blog, email.

## Acceptance criteria
- [ ] `/vibedoc/changelog/` lists every release in CHANGELOG.md, newest first, with New / Fixed groups
- [ ] The footer Changelog link opens it
- [ ] Parser check passes; site tests pass

## Verify
```bash
node site/src/lib/changelog.check.mts
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
### Steps
- [x] 🤖 On the landing page click Changelog in the footer → /vibedoc/changelog/ opens
- [x] 🤖 The page lists every release in CHANGELOG.md, newest first, the newest tagged Latest, with a New group
- [x] 🤖 On desktop click a version in the left list → the page jumps to it and the URL ends with #v<version>
- [x] 🤖 From the changelog, click Features in the header → back to the landing page's Features section
- [ ] Read a few releases → items read as plain sentences (no task ids, no commit hashes), scope chips make sense
- [ ] After the next release: the GitHub release notes end with "All releases in plain words: …/changelog/#v<version>" and the changelog page shows the new version within minutes
### Regression risk
- [ ] Docs sidebar → Changelog opens the page
