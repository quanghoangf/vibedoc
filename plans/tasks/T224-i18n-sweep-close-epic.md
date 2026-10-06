# T224: Every-page Vietnamese sweep, docs, and close R078
**Status:** 📋 Todo
**Phase:** R078 — i18n support
**Size:** M (2–3 hrs)
**Depends on:** T216, T217, T218, T219, T220, T221, T222, T223
**Covers:** S1, S2, S3, S4, S5

## Goal
Prove the epic's Done-when end to end: with Tiếng Việt chosen, no English is left in the UI chrome on any page, and switching back restores English without a reload.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Each area task already added its pages to `e2e/i18n.mjs`. This task finds what fell between them: pages or states no task opened (error page, empty project, loading, the demo mode banner), and text built in places outside the area folders.

## Scope
- [ ] Find hardcoded text the area tasks missed: grep `src/components` and `src/app/(app)` for JSX text and `title=` / `placeholder=` / `aria-label=` / `toast(` with English literals; translate the rest into the right `src/i18n/<area>.ts`
- [ ] `e2e/i18n.mjs`: one run visits every route under `src/app/(app)/` (list them from the folder so a new page gets added automatically), plus an empty fixture project for the empty states; then reload (S3), switch back (S2), and run the glyph check (S5)
- [ ] Docs: MEMORY.md Key conventions gets one i18n line (where messages live, cookie `vibedoc-lang`, typed `vi`, pure libs stay English, check commands); `site/` docs get a short "Language" note in Settings; DESIGN.md mentions Vietnamese text runs ~20–30% longer, so check truncation
- [ ] Check long Vietnamese labels for truncation or overflow in the sidebar, the board column headers, the Settings nav and the buttons in dialogs; fix with the existing Tailwind patterns (`truncate` + `title`, wrapping)
- [ ] Set R078 `**Status:** done` once every task is done

**Out of scope:** new languages; translating MCP or the agent.

## Files
- `e2e/i18n.mjs`: route discovery + full sweep
- `src/i18n/*.ts` and whichever components still have literals
- `memory/MEMORY.md`, `DESIGN.md`, `site/src/content/docs/…` (the Settings page)
- `plans/roadmap/R078-i18n-support.md`: status

## Implementation notes
- The e2e check compares visible text against `en` messages whose `vi` differs, so a literal that never made it into `src/i18n/` won't be caught by it. That is why this task does the grep sweep as well.
- Keep the Undo/restore toasts and the error boundary in the sweep: they only show after an action.

## Acceptance criteria
- [ ] `e2e/i18n.mjs` visits every `(app)` route in vi and passes; it fails if a new route isn't in the list
- [ ] The grep finds no English UI literal in components (allowed: brand, ids, keys, user content)
- [ ] No text overflows its container in vi on the pages above (screenshots in the run)
- [ ] MEMORY.md and the site docs describe the language setting
- [ ] Epic Done-when holds: switching to Tiếng Việt shows every page in Vietnamese; switching back restores English without a reload

## Verify
```bash
node src/lib/i18n.check.mts && node src/lib/shortcuts.check.mts
pnpm lint && pnpm build && pnpm --dir site build
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
- [ ] S1 — WHEN the app is in Vietnamese and the user opens every page → THEN no English interface text is left
- [ ] S2 — WHEN the user switches back to English → THEN the app is English without a reload
- [ ] S3 — WHEN the user reloads in Vietnamese → THEN it stays Vietnamese
- [ ] S4 — WHEN the user looks at dates in Activity and Timeline → THEN they are Vietnamese
- [ ] S5 — WHEN the user tries each font → THEN Vietnamese letters render or the font says it can't
