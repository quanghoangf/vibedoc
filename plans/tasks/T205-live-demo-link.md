# T205: Live demo link (after T135 deploys the Fly.io demo)
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** S (~1 hr)
**Depends on:** T204, T135
**Covers:** S2

## Goal
From the landing page, a visitor opens the real VibeDoc board and roadmap (read-only) in one click.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`, scenario S2.
- The demo itself is R042's job: **T135** (paused) deploys `fly.toml` / `Dockerfile` (`VIBEDOC_DEMO=1`, `examples/demo-project`) to Fly.io. It needs the human's Fly.io account and their go-ahead to publish; this task starts only once T135 is done and its URL is known.
- Fly machines sleep when idle (`auto_stop_machines`), so the first open can take a few seconds.

## Scope
- [ ] "Open live demo" button next to the video, to `<demo url>/board`, and a secondary link to `/roadmap`
- [ ] A short note that it is a read-only demo and may take a moment to wake
- [ ] The demo URL lives in one constant (`site/src/data/links.ts`)
- [ ] Playwright: the link points at the demo URL; a request to it answers 200 (allowing for the cold start)

**Out of scope:** deploying the demo (T135), a custom domain for it.

## Files
- `site/src/data/links.ts` — new (demo URL, GitHub URL)
- `site/src/components/DemoVideo.astro` — add the buttons
- `site/e2e/landing.spec.ts`

## Acceptance criteria
- [ ] The button opens the deployed demo's board in a new tab; the roadmap link opens `/roadmap`
- [ ] The demo URL is defined once

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
curl -sI <demo url>/board | head -1   # 200 (retry once for the cold start)
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] S2 — WHEN a visitor plays the demo video or opens the live demo → THEN they see an agent's task move across the board and the read-only demo opens without installing anything
