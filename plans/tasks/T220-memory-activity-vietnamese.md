# T220: Memory and activity in Vietnamese
**Status:** 👀 Review
**Phase:** R078 — i18n support
**Size:** M (2–3 hrs)
**Depends on:** T215
**Covers:** S1
**Owner:** ai:claude-code
**Due:** 2026-10-09
**Started:** 2026-10-06

## Goal
With Tiếng Việt chosen, every piece of interface text in this area is Vietnamese: headings, buttons, menus, dialogs, empty states, toasts, tooltips, `aria-label`s and placeholders. English looks exactly as it does today.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Pattern from T215: messages in `src/i18n/memory.ts` (`en` as const + `vi: Messages<typeof en>`), registered in `src/i18n/index.ts`, read with `useT()` from `src/context/LanguageContext.tsx`. A missing `vi` key fails the build.
- Not translated: user content (doc text, task/epic titles, entry bodies, custom status names), file paths, ids (T215, R078, E012), keyboard keys, "VibeDoc", and anything MCP or the agent writes.
- Pure libs return English that MCP also uses; map their id/kind to a `t()` key in the component, don't translate inside the lib.
- CLAUDE.md: "No hardcoded UI text in components" (added by T215).

## Scope
- [ ] Create `src/i18n/memory.ts` and register it
- [ ] Replace the hardcoded text in the files below with `t()` (counts and plurals via `plural()`, values via `{placeholders}`)
- [ ] Add /memory (entries, handoff, history, graph) and /activity to `PAGES` in `e2e/i18n.mjs`, opening the panels/dialogs listed in Implementation notes so their text is checked too
- [ ] Natural Vietnamese, not word-for-word: short labels for buttons; keep the established terms consistent with `src/i18n/shell.ts`

**Out of scope:** other pages; entry bodies and activity titles; dates/numbers (T216); help/shortcut text and ⌘K commands (T223).

## Files
- `src/components/memory/*.tsx`: MemoryTab, EntryList, EntryDetail, EntryRelated, EntryHistory, MemoryGraph, MemoryHistory, CleanupPanel, MergeDialog
- `src/components/activity/*.tsx`: ActivityTab, ActivityFeed, ActivityEventRow, SessionCard, SessionTimeline

## Implementation notes
- Activity titles are stored English text that other code parses (`src/lib/activity.ts`: "titles must not change"). Don't translate the title; translate the verb badge / kind chip from `eventCategory` / `eventAction`, and leave the title as user-ish content.
- Entry types (convention, gotcha, decision, preference) are ids from `ENTRY_TYPES`: `t('memory.type.<id>')`.
- Open in the e2e: an entry in read and edit mode, History (N), the cleanup panel, /memory?view=graph, /activity All events with a filter chip.

## Acceptance criteria
- [ ] In vi, /memory (entries, handoff, history, graph) and /activity show no English interface text (`e2e/i18n.mjs` passes for them)
- [ ] In en, the area is unchanged; existing e2e scripts that select by English text still pass
- [ ] `node src/lib/i18n.check.mts` passes (placeholders match)

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
_2026-10-06 — ai · Spec: `e2e/vibedoc/T220-memory-activity-vietnamese.spec.ts` · Auto: passed 2026-10-06_
### Steps
- [x] 🤖 With Vietnamese on, open /memory → the page reads "Bộ nhớ", the list "Mục ghi nhớ" with the type chips quy ước / cạm bẫy / quyết định / sở thích
- [x] 🤖 Click "Dọn dẹp" → the panel is titled "Dọn dẹp" and its flags read as Vietnamese sentences ("Bàn giao ghi …")
- [x] 🤖 Open /activity → the heading reads "Hoạt động", the toggle "Phiên" / "Mọi sự kiện", and a session headline like "… việc được chuyển"
- [x] 🤖 Click "Mọi sự kiện" → the kind filter offers "Việc" and the actor filter "Mọi người" / "Agent" / "Bạn"
- [ ] In Vietnamese, open an entry, Sửa it, open its Lịch sử, and open MEMORY.md Lịch sử with a version → labels, buttons, diff header and restore hint read naturally; entry text and activity titles stay as written
- [ ] In Vietnamese, trigger a merge suggestion (two near-identical entries) and open Gộp… → the dialog reads naturally and Gộp vào E… works
### Regression risk
- [ ] In English, the Cleanup panel's messages, MCP vibedoc_read_memory warnings and session headlines read exactly as before (the English text still comes from memory-health / sessions)
