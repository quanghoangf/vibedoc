# T538: Project groups saved in each repo
**Status:** ✅ Done
**Phase:** R102 — Project groups
**Size:** M (2–3 hrs)
**Depends on:** T531
**Covers:** S2
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16
**Done:** 2026-10-16

## Goal
The user creates a group, adds and removes projects, renames or deletes it; the membership is saved in each repo so the team gets it through git.

## Context
- Epic: `plans/roadmap/R102-project-groups.md`
- Decision: membership lives in each member repo's `.vibedoc/settings.json` as `groups: ["<slug>"]` (committable). The hub forms a group by matching slugs across the projects it knows. No separate groups file. A project can be in several groups.
- Group display name = `groupNames: {"<slug>": "Name"}` in the same settings file (last write wins across members; read the newest by mtime).
- Delete a group = remove the slug from every member's settings; tasks and files otherwise unchanged.
- Settings writes keep every other key (pattern: `saveFrontendOverride`, `readSettingsObject` in core.ts ~line 300).

## Scope
- [ ] Pure `src/lib/groups.ts`: `groupsOf(projects with settings)` → `{slug, name, members}`; `groupSlug(name)` (+ `groups.check.mts`)
- [ ] core `setProjectGroups(root, slugs)`, `listGroups()`
- [ ] `GET /api/groups`, `POST /api/groups/{create,rename,delete,members}` + `emitUpdate("projects_updated")`
- [ ] All projects: groups section (name, members, add/remove members, rename, delete with Undo)
- [ ] CLAUDE.md write list: `.vibedoc/settings.json` gains `groups`, `groupNames`
- [ ] i18n `src/i18n/projects.ts`

**Out of scope:** group board/roadmap (T539, T540), shared memory (R103).

## Files
- `src/lib/groups.ts`, `src/lib/groups.check.mts` — new
- `src/lib/core.ts`, `src/app/api/groups/**/route.ts` — new
- `src/components/projects/GroupSection.tsx` — new
- `CLAUDE.md`, `e2e/project-groups.mjs` — new

## Acceptance criteria
- [ ] Create "Shop" with `web` + `api` → both repos' `.vibedoc/settings.json` contain `"groups": ["shop"]`, other keys unchanged
- [ ] Delete the group → slug gone from both; their tasks unchanged; Undo restores it
- [ ] A hub that knows only `web` still shows the group with one member

## Verify
```bash
node src/lib/groups.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/project-groups.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] All projects → Groups → New group, name "Shop", tick web + api, Create group → a "Shop" row lists both; both repos' `.vibedoc/settings.json` have `"groups": ["shop"]`, `"groupNames": {"shop": "Shop"}` and every other key unchanged (e2e/project-groups.mjs)
- [x] Rename the group → the new name shows and is written into every member's settings; the slug stays (e2e)
- [x] Click × on a member → it leaves the group and its settings lose `groups`; "+ Add project" puts it back with the group's name (e2e)
- [x] Remove api from the hub → `GET /api/groups` still shows the group with web alone (e2e)
- [x] S2 — WHEN the user deletes a group → THEN its projects stay in the hub with their tasks unchanged (e2e: task files byte-for-byte, hub keeps both; Undo restores the slug and name)
- [x] The Groups section reads well at 1400px and 390px (checked on screenshots)
### Regression risk
- [x] All projects in Vietnamese has no English UI text (`e2e/i18n.mjs`: "all projects: no English UI text") and empty states still pass (`e2e/empty-states.mjs`)
