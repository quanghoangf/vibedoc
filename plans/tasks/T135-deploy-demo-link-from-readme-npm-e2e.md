# T135: Deploy demo, link from README/npm, e2e
**Status:** ⏸️ Paused
**Phase:** R042 — Demo & docs site
**Size:** M
**Depends on:** T133, T134

## Goal
The demo is live at a public URL, and the README and npm page link to it. An e2e test keeps demo mode read-only.

## Context
- Epic: `plans/roadmap/R042-demo-and-docs-site.md`
- Epic Done when: "the README and npm page link to the site, and visitors can see the board and roadmap without installing."
- Deploying publishes to an external host: confirm the host and URL with the user before running the deploy.

## Scope
- [ ] Deploy with T2's config; note the URL
- [ ] README: a "Live demo" badge/link near the top → `<url>/welcome`, plus a link to `/getting-started`
- [ ] `package.json`: `homepage` → `<url>/welcome` (shows on the npm page at next publish)
- [ ] e2e (same tooling as earlier e2e tasks, e.g. T131): under `VIBEDOC_DEMO=1`, the board and roadmap render, the banner shows, no create/edit/chat control exists, and a mutating fetch returns 403; `/welcome` and `/getting-started` render
- [ ] `docs/`: a short note on demo mode (`VIBEDOC_DEMO`, `npm run demo`, deploy) and add `VIBEDOC_DEMO` to the Environment section in CLAUDE.md

**Out of scope:** demo GIF/video, custom domain, analytics.

## Files
- `README.md`, `package.json`, `CLAUDE.md`
- e2e spec next to existing ones
- `docs/` demo-mode note

## Acceptance criteria
- [ ] Public URL serves `/welcome`, the board and `/roadmap` without login or install
- [ ] README and `package.json` `homepage` point to the site
- [ ] e2e passes locally
- [ ] Every epic Done-when item is covered

## Verify
```bash
npm run lint && npm run build
# run the e2e suite (script name in package.json)
curl -sI <url>/welcome | head -1   # 200
```
