# T204: Demo video, recorded with VibeDoc's own capture
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** T201
**Covers:** S2

## Goal
A visitor watches an agent's task move across the board in a short clip, without installing anything.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`, scenario S2 (see it working).
- VibeDoc already records video: the Playwright kit (`src/testing/playwright-fixture.ts`) saves a `.webm` per run. The read-only example project is `examples/demo-project` (`pnpm demo` serves it with `VIBEDOC_DEMO=1`), but a recording that shows a task moving needs a writable copy of it plus MCP calls that move the task while the board is open.

## Scope
- [ ] A script `site/scripts/record-demo.mjs` that copies `examples/demo-project` to a temp folder, starts VibeDoc on it, opens the board in Playwright with video on, and drives a short story through `/api/mcp` (claim a task → in progress → done with a checklist) so the card visibly moves; 15–30 seconds
- [ ] Encode to `site/public/demo.mp4` (H.264) + `demo.webm` + a poster frame (ffmpeg); keep the mp4 under ~4 MB
- [ ] Video section on the page: poster, play button, muted, `playsinline`, captions describing what happens
- [ ] Playwright: the video element is present with its poster and can start playing

**Out of scope:** the live demo link (T205), voice-over, several clips.

## Files
- `site/scripts/record-demo.mjs` — new (documented in `site/README.md`)
- `site/public/demo.mp4`, `demo.webm`, `demo-poster.jpg` — generated, committed
- `site/src/components/DemoVideo.astro`, `site/src/pages/index.astro`, `site/e2e/landing.spec.ts`

## Implementation notes
- Reuse the e2e helpers' pattern for a temp fixture (`e2e/stub-chat.mjs` `makeFixture`) and MCP over HTTP (`e2e/verification.mjs`).
- If `ffmpeg` is missing, the script says how to install it and stops; don't add an npm dependency for encoding.

## Acceptance criteria
- [ ] Running the script produces the three files; the clip shows a card moving from Todo to Done
- [ ] The page plays the video inline on desktop and phone (muted autoplay is not required; the play button works)
- [ ] The mp4 is under 4 MB

## Verify
```bash
node site/scripts/record-demo.mjs && ls -lh site/public/demo.*
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] S2 — WHEN a visitor plays the demo video or opens the live demo → THEN they see an agent's task move across the board and the read-only demo opens without installing anything
