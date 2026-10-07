# T442: Draft release notes on /roadmap: diff, Accept writes CHANGELOG.md
**Status:** 📋 Todo
**Phase:** R091 — Release notes from done work
**Size:** M (2–3 hrs)
**Depends on:** T441
**Covers:** S1, S2, S3

## Goal
One click on /roadmap shows the release-notes draft as a diff of `CHANGELOG.md`; Accept writes it, Cancel writes nothing. This is the epic's Done-when.

## Context
- Epic: `plans/roadmap/R091-release-notes-from-done-work.md`
- Reuse the chat's propose-edit card: `ProposalCard` (`src/components/chat/ProposalCard.tsx`) already loads the doc, shows `lineDiff` hunks, and Accept sends `PUT /api/docs {path, edits, actor}` (server re-applies via `editDoc`, emits `doc_updated`). Add an optional `actor` prop (default `"ai"`, the dialog passes `"human"`).
- No hardcoded UI text: `src/i18n/roadmap.ts` (`en` + typed `vi`), `useT()`.
- Hidden in the demo like the other toolbar actions (`!demo`).

## Scope
- [ ] `src/components/roadmap/ReleaseNotesDialog.tsx`: fetch `/api/release-notes`, show "Since <tag> (<date>)" or "No tag yet: all done work", then `ProposalCard` for the draft; nothing new → message, no Accept; on accepted → toast + close
- [ ] Toolbar button "Draft release notes" in `RoadmapTab.tsx`
- [ ] `e2e/release-notes.mjs`: fixture git repo with a tagged commit, a task done before the tag, a task already in CHANGELOG.md, a done epic with two tasks done after; click → diff lists the epic + its two tasks only; Cancel → file unchanged; Accept → section at top, past entries identical; second open → "nothing to draft"
- [ ] `memory/MEMORY.md` Key conventions: one R091 bullet; epic `**Status:** done`

**Out of scope:** tagging, publishing a release, editing past entries.

## Files
- `src/components/roadmap/ReleaseNotesDialog.tsx` — new
- `src/components/roadmap/RoadmapTab.tsx` — button + dialog state
- `src/components/chat/ProposalCard.tsx` — `actor` prop
- `src/i18n/roadmap.ts` — keys
- `e2e/release-notes.mjs` — new (style of `e2e/first-week.mjs`, `makeFixture` from `e2e/stub-chat.mjs`)

## Acceptance criteria
- [ ] S1: after finishing an epic, one click shows a reviewable `CHANGELOG.md` diff listing it
- [ ] S2: Cancel leaves the file unchanged; Accept writes only the new section
- [ ] S3: old / already-listed work is absent; nothing new → nothing to draft
- [ ] `node src/lib/i18n.check.mts` passes

## Verify
```bash
node src/lib/release-notes.check.mts
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3191 pnpm dev   # then:
BASE=http://localhost:3191 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/release-notes.mjs
```

## Manual tests
### Steps
- [ ] S1 — WHEN the user clicks Draft release notes on /roadmap after finishing an epic → THEN a CHANGELOG.md diff shows a new `# Unreleased` section listing that epic and its done tasks since the last tag
- [ ] S2 — WHEN the user closes the draft without accepting → THEN CHANGELOG.md is unchanged; after Accept the section is at the top and past entries are unchanged
- [ ] S3 — WHEN a task was finished before the last tag, or is already in CHANGELOG.md → THEN it is not in the draft; nothing new → nothing to draft
