# T216: Dates and numbers by language, and Vietnamese letters in every font
**Status:** 👀 Review
**Phase:** R078 — i18n support
**Size:** M (2–3 hrs)
**Depends on:** T215
**Covers:** S4, S5
**Owner:** ai:claude-code
**Due:** 2026-10-09
**Started:** 2026-10-06

## Goal
In Vietnamese, dates, times and numbers read the Vietnamese way (`6 thg 10, 2026`), and letters like ạ, ế, ữ render in the chosen font instead of falling back to another one.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- T215 gives `useLang()`; format with `Intl` and the current lang, never a hardcoded `'en-US'`.
- Memory convention: roadmap `**Due:**` is a local calendar date. Never use `new Date("YYYY-MM-DD")` (it shifts by the UTC offset); keep `localToday()` / `dueState()` in `roadmap-health.ts`. Use `timeZone: 'UTC'`, or split the parts yourself, when you format such a date.
- The app layout loads fonts with `subsets: ['latin']`. In this Next version `Geist` only offers `latin` / `latin-ext`.

## Scope
- [ ] `src/lib/i18n.ts`: `formatDate(lang, value, style)`, `formatDateTime`, `formatRelative` (`Intl.RelativeTimeFormat`), `formatNumber`; check cases in `i18n.check.mts`
- [ ] Replace every `toLocale*` / `Intl.*` call in components with these helpers through `useLang()`: `app/(app)/manual-tests/page.tsx`, `app/(app)/memory/page.tsx`, `TestEvidence.tsx`, `FrontendSettings.tsx`, `MemoryHistory.tsx`, `TaskRuns.tsx`, `views/TimelineView.tsx`, `SessionTimeline.tsx`, `ActivityEventRow.tsx`, `FileDetail.tsx`, `DocProperties.tsx`; also hand-built "x ago" / month labels (grep `ago`, `Jan`, `months`)
- [ ] Timeline month axis (`components/board/views/TimelineView.tsx`, `components/roadmap/RoadmapTimeline.tsx`): month names follow the language
- [ ] Fonts in `src/app/layout.tsx`: add `'vietnamese'` to each font's `subsets` where next/font offers it (check the typings in `node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`); for a font that has no Vietnamese subset, check whether `latin-ext` covers the letters; if it doesn't, add a "No Vietnamese letters" note to that font in `SANS_FONTS` / `MONO_FONTS` (`src/lib/settings.ts`)
- [ ] Add the Vietnamese-letter check (S5) to `e2e/i18n.mjs`: for each Settings sans font, render `Tiếng Việt ạ ế ữ` and compare `document.fonts.check()`, or the measured width against the fallback

**Out of scope:** translating UI text (T217–T223); `src/lib/core.ts` dates written to files (they stay ISO / UTC).

## Files
- `src/lib/i18n.ts`, `src/lib/i18n.check.mts`: format helpers + checks
- The 11 component files above, plus `RoadmapTimeline.tsx`
- `src/app/layout.tsx`: font subsets
- `src/lib/settings.ts`: notes for fonts without Vietnamese letters
- `e2e/i18n.mjs`: glyph check

## Implementation notes
- The `src/lib/timeline` / `components/roadmap/timeline.ts` pure layouts compute positions; only the labels they hand to React need the lang. If a pure lib builds a label string, pass the formatter in rather than importing React.
- Vietnamese short month format: `new Intl.DateTimeFormat('vi', {day: 'numeric', month: 'short', year: 'numeric'})`, which gives `6 thg 10, 2026`.

## Acceptance criteria
- [ ] In vi, the activity log, run history, memory history and timeline show Vietnamese dates; in en they look as they do today
- [ ] A due date `2026-10-15` shows as 15 Oct / 15 thg 10 in every time zone (no day shift)
- [ ] Every Settings font either renders Vietnamese letters or says it can't
- [ ] `node src/lib/i18n.check.mts` passes; `e2e/i18n.mjs` passes

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
grep -rn "toLocale\|'en-US'" src/components src/app   # nothing left outside the helpers
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
_2026-10-06 — ai · Spec: `e2e/vibedoc/T216-dates-numbers-vietnamese-glyphs.spec.ts` · Auto: passed 2026-10-06_
### Steps
- [x] 🤖 With Vietnamese on, open /activity → today's events sit under the heading "Hôm nay"
- [x] 🤖 Open /roadmap?view=timeline → the month axis reads "thg 10 2026", "thg 11" … with no English month names
- [x] 🤖 Open /settings → Atkinson Hyperlegible, DM Sans and DM Mono each say "Không có chữ tiếng Việt"
- [x] 🤖 Switch to English and open /activity → the heading reads "Today"
- [ ] In Vietnamese, open a task's Runs, the Test review list and Memory → History → times read "5 phút trước", dates "6 thg 10", and hover titles show Vietnamese date-times
- [ ] In Vietnamese, pick Inter, IBM Plex Sans and JetBrains Mono in Settings → Vietnamese letters (ạ, ế, ữ) look like the rest of the font, not a different fallback
### Regression risk
- [ ] In English, the board Timeline view (Active / Day / Week), the roadmap timeline and activity times look exactly as before (e.g. "5m ago", "Oct 6", 24-hour clock)
