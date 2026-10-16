# T542: Shared entries on the Memory tab
**Status:** 👀 Review
**Phase:** R103 — Shared group memory
**Size:** M (2–3 hrs)
**Depends on:** T541
**Covers:** S1, S2
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16

## Goal
The Memory tab shows the group's shared entries next to the project's own, lets the user edit them where they live, and flip an entry between project and group scope.

## Context
- Epic: `plans/roadmap/R103-shared-group-memory.md`
- `/memory` = `EntryList` + `EntryDetail` (R047). Add a scope filter chip (All · This project · Shared) next to the type chips; shared rows carry the owning project's name.
- Editing a shared entry saves into its own repo (`POST /api/memory/entries/save?root=<owner>`), so the existing route works; `?entry=api:E003` deep link for foreign entries.
- Scope toggle in `EntryDetail` = rewrite the `**Scope:**` line via `saveEntry`.
- Rule: i18n in `src/i18n/memory.ts`.

## Scope
- [ ] `GET /api/memory/entries` adds `shared: Entry & {project}` list
- [ ] `EntryList` scope chip + shared label; `filterEntries` in `recall.ts` takes the scope (+ check)
- [ ] `EntryDetail` scope switch; edit/delete/Undo on a shared entry hit the owner repo
- [ ] Hidden when the project is in no group

**Out of scope:** moving an entry's file to another repo.

## Files
- `src/app/api/memory/entries/route.ts`
- `src/components/memory/EntryList.tsx`, `src/components/memory/EntryDetail.tsx`
- `src/lib/recall.ts` (+ check), `src/i18n/memory.ts`
- `e2e/group-memory.mjs`, `e2e/memory-browser.mjs` (must still pass)

## Acceptance criteria
- [ ] In `web`, Shared chip lists `api`'s group entries with "api"; editing one changes the file in `api`
- [ ] Switching an entry to project scope removes it from `web`'s list after SSE refresh
- [ ] Project in no group: no scope chip, page as today; `e2e/memory-browser.mjs` passes

## Verify
```bash
node src/lib/recall.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/group-memory.mjs && BASE=http://localhost:3081 node e2e/memory-browser.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] S1 — WHEN an agent saves an entry with group scope in project A → THEN the next session in project B of the same group lists it, marked shared
- [x] S2 — WHEN an entry has project scope → THEN it never appears in other projects of the group
- [x] In web, open /memory → a "Filter by scope" row (All · This project · Shared); Shared lists api's group entry with an "api" label
- [x] Open the shared entry → Edit → change the summary → Save → the file in api is renamed and keeps **Scope:** group; nothing is written in web
- [x] Click "Keep in this project" on it → it leaves web's list; api's file loses its **Scope:** line
- [ ] In api, open an own entry → "Share with group" → the Scope row reads "Shared with the group" and the row gets a "Shared" tag
- [ ] The scope chips and the project label on shared rows look right next to the type chips (spacing, phone width)
### Regression risk
- [x] A project in no group: /memory has no scope filter and works as before (e2e/memory-browser.mjs passes)
