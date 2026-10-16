# T538: Project groups saved in each repo
**Status:** 📋 Todo
**Phase:** R102 — Project groups
**Size:** M (2–3 hrs)
**Depends on:** T531
**Covers:** S2

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

## Manual tests
- [ ] S2 — WHEN the user deletes a group → THEN its projects stay in the hub with their tasks unchanged

## Verify
```bash
node src/lib/groups.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/project-groups.mjs
```
