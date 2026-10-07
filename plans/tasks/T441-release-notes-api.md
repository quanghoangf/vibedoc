# T441: Release notes draft from the project: last tag + GET /api/release-notes
**Status:** 📋 Todo
**Phase:** R091 — Release notes from done work
**Size:** S (~1 hr)
**Depends on:** T440
**Covers:** S3

## Goal
`GET /api/release-notes` returns the draft for the current project: the last tag it counts from, the section text and the edits for `CHANGELOG.md`, read-only.

## Context
- Epic: `plans/roadmap/R091-release-notes-from-done-work.md`
- "Only `src/lib/core.ts` touches the file system" — git and the CHANGELOG read go in core. Use the existing `git()` helper (execFile, argument array) near `getFileHistory()`.
- Read-only: no `emitUpdate()` (nothing mutates). The write is the existing `PUT /api/docs`.

## Scope
- [ ] `core.getReleaseNotesDraft(root)`: last tag = `git describe --tags --abbrev=0`, its date = `git log -1 --format=%cs <tag>`; no git / no tag → `since: null`; read `CHANGELOG.md` ('' if missing); `listTasks` + `listRoadmap` → T440's functions → `{ path: 'CHANGELOG.md', since: {tag, date} | null, section, edits, count }`
- [ ] `src/app/api/release-notes/route.ts`: `GET` with `?root=` (`rootFrom`), 400 `{error}` on failure

**Out of scope:** an MCP tool (the UI dialog is the propose-edit flow for this epic), UI (T442).

## Files
- `src/lib/core.ts` — add `getReleaseNotesDraft()` next to the git helpers
- `src/app/api/release-notes/route.ts` — new; copy the GET shape of `src/app/api/roadmap/spec-merge/route.ts`

## Acceptance criteria
- [ ] On this repo `curl /api/release-notes` names the latest tag and lists only tasks finished on/after its date that CHANGELOG.md doesn't name
- [ ] A project without git answers 200 with `since: null`

## Verify
```bash
pnpm lint && pnpm build
curl -s 'http://localhost:3191/api/release-notes' | head -c 600
```

## Manual tests
### Steps
- [ ] S3 — WHEN a task was finished before the last tag, or its id is already in CHANGELOG.md → THEN it is not in the draft
