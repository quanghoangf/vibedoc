# T353: Maintainer funnel, privacy docs, close R086
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Phase:** R086 — First-run feedback
**Size:** M (2–3 hrs)
**Depends on:** T350, T351, T352
**Covers:** S2, S3

## Goal
The maintainer reads the opted-in first runs as a step funnel, users can read exactly what is collected, and the epic's Done-when is proven end to end.

## Context
- Epic: `plans/roadmap/R086-first-run-feedback.md`
- Events land in GoatCounter as `/first-run/<step>` (T350). GoatCounter's API (`GET /api/v0/stats/hits`, bearer token) gives counts per path; the maintainer's token stays in their env (`GOATCOUNTER_TOKEN`), never in the repo.

## Scope
- [ ] `scripts/first-run-funnel.mjs`: reads `GOATCOUNTER_TOKEN` (+ optional `--days 30`), fetches the four `/first-run/*` counts, prints a table `step · count · % of started · drop from previous`; pure formatting in a function covered by an inline self-check (`node scripts/first-run-funnel.mjs --check` with fixed numbers, no network)
- [ ] Docs: `site/src/content/docs/docs/` page "First-run feedback" (what is asked, the exact requests, what is never sent, how to turn it off, the Stuck link); `README.md` one line linking it; `memory/MEMORY.md` Key conventions one line
- [ ] `e2e/first-run-feedback.mjs` runs clean from fresh fixtures covering S1–S5 in one pass
- [ ] Set R086 `**Status:** done` once every task is done

**Out of scope:** a dashboard page in VibeDoc, any analytics beyond the four steps.

## Files
- `scripts/first-run-funnel.mjs` — new
- `site/src/content/docs/docs/…/first-run-feedback.md` — new (match the sidebar config in `site/astro.config.*`)
- `README.md`, `memory/MEMORY.md`
- `plans/roadmap/R086-first-run-feedback.md` (status)

## Acceptance criteria
- [ ] `node scripts/first-run-funnel.mjs --check` prints a funnel from fixed numbers; without a token it says how to set one and exits non-zero
- [ ] Epic Done-when: an opted-in first run in the e2e produces the four step requests in order (= what the funnel counts), and an opted-out run produces none
- [ ] The docs page builds (`pnpm --dir site build`) and lists every URL VibeDoc can request

## Verify
```bash
node scripts/first-run-funnel.mjs --check
node src/lib/first-run.check.mts
pnpm lint && pnpm build
pnpm --dir site build
BASE=http://localhost:3086 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/first-run-feedback.mjs
```

## Manual tests
_Auto: `node scripts/first-run-funnel.mjs --check`, `node src/lib/first-run.check.mts` (privacy page lists exactly the four URLs), `e2e/first-run-feedback.mjs` (S1–S5 in one pass), `pnpm --dir site build` passed 2026-10-07._
### Steps
- [x] S2 — WHEN the user opts in and goes through start → agent connected → first roadmap → first task done → THEN the four step requests go out in order (what the funnel counts)
- [x] S3 — WHEN the user declines, or never answers → THEN no request leaves VibeDoc for the analytics host
- [ ] Human: `GOATCOUNTER_TOKEN=… node scripts/first-run-funnel.mjs` against the real site → the funnel prints (needs a real opted-in run first; confirms GoatCounter accepts the localhost hits and whether it stores the event path with or without the leading "/" — the script reads both)
- [ ] Open the site docs → Start → "First-run feedback & privacy" reads clearly and matches the card
### Regression risk
- [ ] The site's own GoatCounter page counting (count.js on the landing page) is unchanged
