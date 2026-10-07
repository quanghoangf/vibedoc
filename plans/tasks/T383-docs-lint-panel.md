# T383: Lint line + panel on /docs, opens each issue
**Status:** ✅ Done
**Phase:** R088 — Docs quality gate
**Size:** M (2–3 hrs)
**Depends on:** T381
**Covers:** S2, S3

## Goal
On /docs the user sees "N errors · M warnings" and can click any issue to open the doc at that spot.

## Context
- Epic: `plans/roadmap/R088-docs-quality-gate.md`
- CLAUDE.md: no hardcoded UI text → `src/i18n/docs.ts` (`en` + typed `vi`), `useT()`. No localStorage. Tailwind only.
- Link issues carry `target`: open with `openDoc(path, target)` (AppContext) → existing `?link=` reveal. Other issues: open the doc and scroll to the nearest heading at or before the issue's line.
- Refetch on SSE `doc_updated` (the docs page already listens to `vibedoc:sse`).

## Scope
- [ ] `DocLintPanel` in `src/components/docs/`: a compact line in the doc list ("3 errors · 12 warnings", or "Docs check passed"); click toggles a list of issues grouped by file (level, rule, `L12`, message).
- [ ] Clicking an issue opens the doc at the spot (link target or heading).
- [ ] e2e `e2e/docs-lint.mjs` on a fixture: a broken link + a no-H1 doc → the line shows the counts; click the broken-link issue → that doc opens (`?doc=`); search for a title word → that doc listed first (S3).

**Out of scope:** auto-fixing.

## Files
- `src/components/docs/DocLintPanel.tsx` — new
- `src/components/docs/DocList.tsx` — mount it
- `src/i18n/docs.ts`
- `e2e/docs-lint.mjs` — new; style of `e2e/first-week.mjs` (`makeFixture`, `launchChrome` from `e2e/stub-chat.mjs`)

## Acceptance criteria
- [ ] S2: the line shows counts; clicking an issue opens that doc.
- [ ] S3: a title search lists that doc first.
- [ ] vi translation present (build fails otherwise).

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3188 pnpm dev   # then: BASE=http://localhost:3188 node e2e/docs-lint.mjs
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [x] S2 — WHEN the user opens /docs on a project with issues → THEN a line shows "N errors · M warnings", and clicking an issue opens the doc at that spot (e2e/docs-lint.mjs)
- [x] S3 — WHEN anyone searches docs for words in a doc's title → THEN that doc ranks above docs that only mention the words in the body (e2e/docs-lint.mjs)
- [ ] Open /docs on this repo → under the Docs header a line reads "0 errors · 52 warnings" (or the current counts); click it → issues grouped by file
- [ ] Click a "Missing file" issue → that doc opens and the backticked path flashes in view
- [ ] Click a "Not linked from anywhere" issue → that doc opens at the top
- [ ] Switch the language to Tiếng Việt → the line and rule labels are Vietnamese
### Regression risk
- [ ] Doc search box, Select mode and the sort/filter menu in the doc list still work with the new line above the search
