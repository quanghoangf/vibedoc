# T351: Turn first-run feedback on or off in Settings
**Status:** 📋 Todo
**Phase:** R086 — First-run feedback
**Size:** S (~1 hr)
**Depends on:** T350
**Covers:** S5

## Goal
The user can change their answer any time: Settings has a "Privacy" tab with the first-run feedback switch and the same "what is sent" text as the card.

## Context
- Epic: `plans/roadmap/R086-first-run-feedback.md`
- State lives in `.vibedoc/feedback.json` via `POST /api/feedback { consent }` (T350), not in `AppSettings`; the tab reads `GET /api/feedback`.
- Turning it on from Settings uses the same `applyConsent` rule as the card (already-reached steps other than `started` are not sent). Turning it off stops sending at once.
- CLAUDE.md: "No hardcoded UI text in components" (`src/i18n/feedback.ts` / `settings.ts`, en + vi).

## Scope
- [ ] `src/components/settings/PrivacySettings.tsx`: switch + "what is sent / never sent" (reuse the card's text component or keys from T350 rather than a second copy)
- [ ] `src/app/(app)/settings/page.tsx`: a `privacy` tab (icon `ShieldCheck`)
- [ ] Extend `e2e/first-run-feedback.mjs`: opted-out project → Settings → turn on → next step is sent; turn off → the following step is not

**Out of scope:** the Stuck link (T352), docs (T353).

## Files
- `src/components/settings/PrivacySettings.tsx` — new
- `src/app/(app)/settings/page.tsx` — tab
- `src/i18n/settings.ts` or `src/i18n/feedback.ts`
- `e2e/first-run-feedback.mjs`

## Acceptance criteria
- [ ] The switch shows the current answer (off when never asked) and saves on change
- [ ] On → off: no further goatcounter request; off → on: the next reached step is sent
- [ ] Demo mode: the tab says it is off in the demo and the switch is disabled
- [ ] `e2e/first-run-feedback.mjs` and `e2e/i18n.mjs` pass

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3086 PW_DIR=. node e2e/first-run-feedback.mjs
BASE=http://localhost:3086 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
- [ ] S5 — WHEN the user turns first-run feedback off (or on) in Settings → THEN sending stops (or starts) from the next step on
