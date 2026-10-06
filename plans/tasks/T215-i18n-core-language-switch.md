# T215: i18n core, language switch and the app shell in Vietnamese
**Status:** 👀 Review
**Phase:** R078 — i18n support
**Size:** L (half a day)
**Covers:** S2, S3
**Owner:** ai:claude-code
**Due:** 2026-10-13
**Started:** 2026-10-06

## Goal
A user picks Tiếng Việt in Settings → Appearance and the sidebar, header and help launcher switch to Vietnamese at once, and stay Vietnamese after a reload. This lays the pattern every later R078 task follows.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Decision: hand-rolled translations, no new dependency (no next-intl). English is the typed source of truth; Vietnamese is typed against it, so a missing key fails `pnpm build`. There is no runtime fallback.
- Decision: the choice is stored in a cookie `vibedoc-lang` (`en` | `vi`, path `/`, 1 year), per browser, not in `.vibedoc/settings.json`. Teammates on the same repo don't share it.
- CLAUDE.md: "Never use `localStorage` — SSR/client mismatch." The cookie is read on the server so the first paint and `<html lang>` are right.
- Messages are split per area so the parallel area tasks (T217–T223) never edit the same file.
- Out of scope for the whole epic: user content (doc text, task/epic titles, custom status names), MCP tool text and agent replies, the docs site, right-to-left.

## Scope
- [ ] `src/lib/i18n.ts` (pure, no React): `LANGS = ['en', 'vi']`, `type Lang`, `parseLang(cookieValue)` (unknown → `en`), `interpolate(msg, vars)` for `{name}`, `plural(lang, n, {one, other})` with `Intl.PluralRules`, and `placeholdersMatch(en, vi)`
- [ ] `src/i18n/<area>.ts` message modules: each exports `en` (`as const`) and `vi: Messages<typeof en>`; this task creates `src/i18n/shell.ts` (sidebar, header, project switcher, live indicator, stats pills, help launcher frame)
- [ ] `src/i18n/index.ts` merges the areas under a prefix (`shell.newChat`), exports `messages: Record<Lang, …>` and the `MessageKey` type
- [ ] `src/context/LanguageContext.tsx`: `LanguageProvider` (initial lang from props), `useT()` → `t(key, vars?)`, `useLang()` → `{lang, setLang}`; `setLang` writes the cookie, sets `document.documentElement.lang` and re-renders, with no reload
- [ ] `src/app/layout.tsx` reads the cookie with `await cookies()` (next/headers), sets `<html lang>` and passes the lang to the provider
- [ ] Settings → Appearance (`ThemeSettings.tsx`): a Language row (English / Tiếng Việt), with each label written in its own language
- [ ] Translate `components/layout/` AppSidebar, AppHeader, AppShell, ProjectSwitcher, SidebarChats, and the HelpLauncher frame (the help *content* is T223)
- [ ] `src/lib/i18n.check.mts`: interpolation, plurals, `parseLang`, and every `vi` message has the same `{placeholders}` as its `en` message (imports the area modules)
- [ ] `e2e/i18n.mjs`: switch to vi in Settings, then for each page in a `PAGES` list collect visible text and fail on any string equal to an `en` message whose `vi` differs; reload, still vi; switch back, English without reload. `PAGES` starts with the shell on `/board`
- [ ] CLAUDE.md Non-negotiables: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` and use `useT()`."

**Out of scope:** dates/numbers and fonts (T216); page content per area (T217–T223).

## Files
- `src/lib/i18n.ts`: new, pure helpers
- `src/lib/i18n.check.mts`: new
- `src/i18n/shell.ts`, `src/i18n/index.ts`: new
- `src/context/LanguageContext.tsx`: new
- `src/app/layout.tsx`: read the cookie, `<html lang>`, provider
- `src/components/settings/ThemeSettings.tsx`: Language row
- `src/components/layout/*.tsx`: use `t()`
- `e2e/i18n.mjs`: new; follow `e2e/specs.mjs` (`launchChrome`, `makeFixture` from `e2e/stub-chat.mjs`, fail on console errors)
- `CLAUDE.md`: one non-negotiable

## Implementation notes
- Type shape the area tasks rely on: `type Messages<T> = { [K in keyof T]: string }`. Keep keys flat inside an area (`newTask`, `emptyBoard`), with no nesting.
- `cookies()` makes the root layout dynamic. That's fine, because the app reads the file system on every request anyway.
- Pure libs (`roadmap-health`, `statuses`, `review` …) return English text that MCP also uses. Don't translate inside them; components map the id/kind to a `t()` key.
- The sidebar labels are also used by ⌘K commands. Leave the palette to T223, but don't break its matching.
- Don't add new `react-hooks` lint errors (16 already exist).

## Acceptance criteria
- [ ] Choosing Tiếng Việt changes the sidebar and header text at once; `document.documentElement.lang === 'vi'`
- [ ] A reload keeps Vietnamese, with no English flash on first paint (the server renders vi)
- [ ] Switching back to English restores the text without a reload
- [ ] With no cookie, or a bad value, the app is English
- [ ] Removing a key from `vi` in `shell.ts` fails `pnpm build`
- [ ] `node src/lib/i18n.check.mts` passes; `e2e/i18n.mjs` passes for `/board`

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
pnpm dev &  # then:
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
_2026-10-06 — ai · Spec: `e2e/vibedoc/T215-i18n-core-language-switch.spec.ts` · Auto: passed 2026-10-06_
### Steps
- [x] 🤖 Open /settings → Appearance shows a Language row with English selected and Tiếng Việt next to it
- [x] 🤖 Click Tiếng Việt → the sidebar reads Bảng, Lộ trình, Tài liệu at once and the header search says Tìm kiếm…
- [x] 🤖 Reload → the app is still in Vietnamese
- [x] 🤖 Click English in Settings → the sidebar reads Board again without a reload
- [ ] In Vietnamese, read the sidebar, the header (agent status, Connect menu, project switcher) and the sidebar Chats section → the wording reads naturally and nothing is cut off, also with the sidebar collapsed
- [ ] Open the app in a private window while your normal window is in Vietnamese → the private window is English (the choice belongs to each browser)
### Regression risk
- [ ] In English, the sidebar links, their keyboard shortcuts and the header agent status counts work as before
