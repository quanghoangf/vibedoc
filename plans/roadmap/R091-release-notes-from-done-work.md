# R091: Release notes from done work
**Parent:** R004
**Status:** planned
**Order:** 120
**Tasks:** T440, T441, T442

The changelog writes itself from what was finished: done epics and tasks since the last tag become a draft `CHANGELOG.md` section the user accepts. Adapted from Fern's changelog pages.

**In scope:** collect done epics/tasks since the last git tag; draft via `vibedoc_propose_edit` (diff, then Accept); a Draft release notes action on /roadmap
**Out of scope:** publishing releases, tagging, editing past entries
**Done when:** after finishing an epic, one click produces a reviewable CHANGELOG section listing it

## Scenarios
### S1: One click drafts the section
- WHEN the user clicks Draft release notes on /roadmap after finishing an epic
- THEN a diff of `CHANGELOG.md` shows a new `# Unreleased` section at the top listing that epic and its done tasks finished since the last git tag
### S2: Nothing written without Accept
- WHEN the user closes the draft without accepting
- THEN `CHANGELOG.md` is unchanged; after Accept the section is at the top and every past entry is byte-for-byte the same
### S3: Only new work
- WHEN a task was finished before the last tag, or its id is already named in `CHANGELOG.md`
- THEN it is not in the draft; with nothing new the dialog says there is nothing to draft and Accept is off
