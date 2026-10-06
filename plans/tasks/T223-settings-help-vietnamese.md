# T223: Settings, help, shortcuts, ⌘K and shared UI in Vietnamese
**Status:** 📋 Todo
**Phase:** R078 — i18n support
**Size:** L (half a day)
**Depends on:** T215
**Covers:** S1

## Goal
With Tiếng Việt chosen, every piece of interface text in this area is Vietnamese: headings, buttons, menus, dialogs, empty states, toasts, tooltips, `aria-label`s and placeholders. English looks exactly as it does today.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Pattern from T215: messages in `src/i18n/settings.ts` (`en` as const + `vi: Messages<typeof en>`), registered in `src/i18n/index.ts`, read with `useT()` from `src/context/LanguageContext.tsx`. A missing `vi` key fails the build.
- Not translated: user content (doc text, task/epic titles, entry bodies, custom status names), file paths, ids (T215, R078, E012), keyboard keys, "VibeDoc", and anything MCP or the agent writes.
- Pure libs return English that MCP also uses; map their id/kind to a `t()` key in the component, don't translate inside the lib.
- CLAUDE.md: "No hardcoded UI text in components" (added by T215).

## Scope
- [ ] Create `src/i18n/settings.ts` and register it
- [ ] Replace the hardcoded text in the files below with `t()` (counts and plurals via `plural()`, values via `{placeholders}`)
- [ ] Add /settings (every section), the Help panel, ⌘K and Quick open to `PAGES` in `e2e/i18n.mjs`, opening the panels/dialogs listed in Implementation notes so their text is checked too
- [ ] Natural Vietnamese, not word-for-word: short labels for buttons; keep the established terms consistent with `src/i18n/shell.ts`

**Out of scope:** the area pages (T217–T222); dates/numbers (T216); help/shortcut text and ⌘K commands (T223).

## Files
- `src/components/settings/*.tsx`: ThemeSettings (rest of it), EditorSettings, ProjectSettings, MCPSettings, FrontendSettings, StatusesSettings, SkillsSettings, AgentsSettings; `src/app/(app)/settings/page.tsx`
- `src/lib/shortcuts.ts`: `PAGE_HELP`, `SHORTCUT_SECTIONS` text → keys
- `src/components/layout/HelpLauncher.tsx` (content), `CommandPalette.tsx`, `QuickOpen.tsx`; `src/components/shared/item-commands.ts`
- `src/components/ui/toast.tsx` (Undo etc.), `dialog.tsx` / `sheet.tsx` close labels; `src/lib/settings.ts` `SANS_FONTS` / `MONO_FONTS` notes; `src/app/(app)/error.tsx`, `LoadingScreen`

## Implementation notes
- `shortcuts.ts` is a pure lib with a self-check (`node src/lib/shortcuts.check.mts`: every help key is in the full list). Make its entries carry message keys and resolve them with `t()` in HelpLauncher, so the check keeps working without importing React.
- ⌘K must still match what the user types in their language: match against the translated label (and also the English one, so muscle memory still works).
- Open in the e2e: each Settings section, the pinned Help panel on two pages, ⌘K with a query, an Undo toast.

## Acceptance criteria
- [ ] In vi, /settings (every section), the Help panel, ⌘K and Quick open show no English interface text (`e2e/i18n.mjs` passes for them)
- [ ] In en, the area is unchanged; existing e2e scripts that select by English text still pass
- [ ] `node src/lib/i18n.check.mts` passes (placeholders match)

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
- [ ] S1 — WHEN the app is in Vietnamese and the user opens /settings (every section), the Help panel, ⌘K and Quick open → THEN every interface text is Vietnamese
