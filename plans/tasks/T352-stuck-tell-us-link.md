# T352: "Stuck? Tell us" link to a prefilled GitHub issue
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Phase:** R086 — First-run feedback
**Size:** S (~1 hr)
**Depends on:** T350
**Covers:** S4

## Goal
A new user who gets stuck can tell the maintainer in one click: a one-line "Stuck? Tell us" link opens a GitHub issue prefilled with the VibeDoc version, OS and the last first-run step reached, and nothing from their project.

## Context
- Epic: `plans/roadmap/R086-first-run-feedback.md`
- Works with or without consent: the user opens the issue themselves and sees the text before submitting.
- Placement: in the Help panel (`src/components/layout/HelpLauncher.tsx`, bottom-right on every page) and on the T350 card. **Seam for R084:** the first-week checklist can show the same link later.
- Last step reached comes from `reachedSteps` (T350); expose it in `GET /api/feedback` as `lastStep` if it isn't already.
- Version: `VIBEDOC_VERSION` (`src/lib/version.ts`) passed in from the API, not imported into the pure lib. OS: `navigator.platform` / `userAgentData.platform` short name.
- Repo URL: the `GITHUB` constant copied into `src/lib/first-run.ts` in T350.

## Scope
- [ ] `issueUrl({ version, os, lastStep })` in `src/lib/first-run.ts` → `${GITHUB}/issues/new?title=…&body=…&labels=first-run` (body: "What were you trying to do?", "What happened?", then version / OS / last step); add its cases to `first-run.check.mts` (no project path / name in the URL, everything encoded)
- [ ] Link in the Help panel and on the consent card, `target="_blank" rel="noopener"`
- [ ] Extend `e2e/first-run-feedback.mjs`: the link's href is a github.com new-issue URL containing the version and last step and not the fixture's path or name

**Out of scope:** sending anything automatically (the user submits the issue), screenshots/log attachments.

## Files
- `src/lib/first-run.ts`, `src/lib/first-run.check.mts`
- `src/app/api/feedback/route.ts` — `version`, `lastStep`
- `src/components/layout/HelpLauncher.tsx`, `src/components/layout/FirstRunFeedback.tsx`
- `src/i18n/feedback.ts` / `src/i18n/help.ts`
- `e2e/first-run-feedback.mjs`

## Acceptance criteria
- [ ] Clicking the link opens github.com/quanghoangf/vibedoc/issues/new with the title and body prefilled
- [ ] The URL has the version, OS and last step, and no project name, path or content
- [ ] Check, e2e and i18n e2e pass

## Verify
```bash
node src/lib/first-run.check.mts
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3086 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/first-run-feedback.mjs
BASE=http://localhost:3086 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/i18n.mjs
```

## Manual tests
_Auto: `e2e/first-run-feedback.mjs` (part 4) + `e2e/i18n.mjs` passed 2026-10-07._
### Steps
- [x] S4 — WHEN the user clicks "Stuck? Tell us" → THEN a GitHub issue opens prefilled with the VibeDoc version, OS and the last step reached, and nothing from the project
- [ ] Click "Stuck? Tell us" in the Help panel while logged in to GitHub → the new-issue form opens in a new tab with the title and body filled (the `first-run` label only applies if it exists in the repo)
- [ ] Hover the link → the tooltip says what the issue will contain
### Regression risk
- [ ] The Help panel still peeks on hover and closes on Esc; "All shortcuts" still works
