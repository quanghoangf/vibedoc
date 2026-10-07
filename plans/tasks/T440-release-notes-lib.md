# T440: Release notes lib: pick new done work, format the section, build the edit
**Status:** 📋 Todo
**Phase:** R091 — Release notes from done work
**Size:** S (~1 hr)
**Depends on:** —
**Covers:** S3

## Goal
The logic of the draft lives in one pure, checked module: which done tasks/epics are new since the last tag, how the `# Unreleased` section reads, and the old_string→new_string edit that puts it at the top of `CHANGELOG.md`.

## Context
- Epic: `plans/roadmap/R091-release-notes-from-done-work.md`
- Decision: the draft is a `TextEdit[]` (Claude Code Edit semantics, `src/lib/diff.ts`) shown in the existing proposal diff and written by the existing `PUT /api/docs {edits}` → `core.editDoc()`. Nothing is written without Accept.
- "Done since the last tag" = task status `done` with `**Done:**` (`Task.finished`, YYYY-MM-DD) ≥ the tag's date (string compare, never `new Date`), minus every task id already named in `CHANGELOG.md` outside an existing top `# Unreleased` section (that dedupes same-day work). No tag → every done task with a Done date.
- Pure libs never import values from each other (`node *.check.mts` runs without a bundler): `import type` only.

## Scope
- [ ] `src/lib/release-notes.ts`: `collectReleaseNotes({ tasks, epics, since, changelog })` → `{ groups: { epic: {id,title,status} | null, tasks: {id,title}[] }[] }` (epics in roadmap order, loose tasks last); `formatReleaseNotes(groups, today)` → `# Unreleased (YYYY-MM-DD)` + `### <epic title> (R091)` (+ ` — in progress` when the epic isn't done) + `* <task title> (T440)` lines, `### Other` for loose tasks; `releaseNotesEdits(changelog, section)` → `TextEdit[]`
- [ ] Edit rules: empty file → `[{old_string: "", new_string: section}]`; an existing top `# Unreleased` section → replace exactly that section; else insert before the first line (old_string = first line, which must be unique; otherwise fall back to the first heading line)
- [ ] `src/lib/release-notes.check.mts` asserting each rule, applied through `applyEdits` from `diff.ts` (relative `.ts` import is fine in the check)

**Out of scope:** reading git / files (T441), UI (T442), tagging or publishing.

## Files
- `src/lib/release-notes.ts` — new
- `src/lib/release-notes.check.mts` — new

## Acceptance criteria
- [ ] A task done before `since`, or whose id appears in the changelog, is excluded; same-day tasks not in the changelog are included
- [ ] Applying the edits to a changelog with past entries leaves every past byte identical; a second draft replaces the old Unreleased section instead of stacking another
- [ ] Nothing new → no groups (the caller shows "nothing to draft")

## Verify
```bash
node src/lib/release-notes.check.mts
pnpm lint && pnpm build
```

## Manual tests
### Steps
- [ ] S3 — WHEN a task was finished before the last tag, or its id is already in CHANGELOG.md → THEN it is not in the draft; nothing new → nothing to draft
