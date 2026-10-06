# T221: Test review and evidence in Vietnamese
**Status:** 📋 Todo
**Phase:** R078 — i18n support
**Size:** M (2–3 hrs)
**Depends on:** T215
**Covers:** S1

## Goal
With Tiếng Việt chosen, every piece of interface text in this area is Vietnamese: headings, buttons, menus, dialogs, empty states, toasts, tooltips, `aria-label`s and placeholders. English looks exactly as it does today.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Pattern from T215: messages in `src/i18n/tests.ts` (`en` as const + `vi: Messages<typeof en>`), registered in `src/i18n/index.ts`, read with `useT()` from `src/context/LanguageContext.tsx`. A missing `vi` key fails the build.
- Not translated: user content (doc text, task/epic titles, entry bodies, custom status names), file paths, ids (T215, R078, E012), keyboard keys, "VibeDoc", and anything MCP or the agent writes.
- Pure libs return English that MCP also uses; map their id/kind to a `t()` key in the component, don't translate inside the lib.
- CLAUDE.md: "No hardcoded UI text in components" (added by T215).

## Scope
- [ ] Create `src/i18n/tests.ts` and register it
- [ ] Replace the hardcoded text in the files below with `t()` (counts and plurals via `plural()`, values via `{placeholders}`)
- [ ] Add /manual-tests (task list, run replay, Evidence view, Suite tab) to `PAGES` in `e2e/i18n.mjs`, opening the panels/dialogs listed in Implementation notes so their text is checked too
- [ ] Natural Vietnamese, not word-for-word: short labels for buttons; keep the established terms consistent with `src/i18n/shell.ts`

**Out of scope:** other pages; EVIDENCE.md and run step names; dates/numbers (T216); help/shortcut text and ⌘K commands (T223).

## Files
- `src/app/(app)/manual-tests/page.tsx`
- `src/components/manual-tests/*.tsx`: TestDetail, TestEvidence, RunLive, RunPlayer, SuiteTab, TestBulkBar

## Implementation notes
- The Evidence view renders text from `src/lib/evidence.ts` (`formatEvidence`, also written to EVIDENCE.md and returned by MCP): leave that markdown English; translate only the UI around it (tabs, verdict chips, buttons).
- Tab names Needs you / Failed / Passed / Flaky / No run, review marks (❔ unverified etc.) and the "The suite is running" message.
- Open in the e2e: each tab, a task with a run, `?view=evidence`, `?tab=suite`.

## Acceptance criteria
- [ ] In vi, /manual-tests (task list, run replay, Evidence view, Suite tab) show no English interface text (`e2e/i18n.mjs` passes for them)
- [ ] In en, the area is unchanged; existing e2e scripts that select by English text still pass
- [ ] `node src/lib/i18n.check.mts` passes (placeholders match)

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
- [ ] S1 — WHEN the app is in Vietnamese and the user opens /manual-tests (task list, run replay, Evidence view, Suite tab) → THEN every interface text is Vietnamese
