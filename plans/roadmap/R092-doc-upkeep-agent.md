# R092: Doc upkeep agent
**Parent:** R004
**Status:** planned
**Order:** 130
**Tasks:** T460, T461, T462

Docs stop drifting from the code: when a task is done, docs that mention files its commits changed are flagged, and one click asks the agent to propose fixes. Adapted from Fern Agent, which fixes docs from reader signals.

**In scope:** map a done task's commits (`git log --grep=<id>`, as in verify context) to docs that reference the changed files; a "may be outdated" flag on those docs; Fix docs → `askAgent()` with R088's lint + the diff → `vibedoc_propose_edit`
**Out of scope:** scheduled runs, editing without Accept
**Done when:** finishing a task that renames a file flags the doc mentioning it, and Fix docs proposes the corrected path

## Scenarios
### S1: Outdated flag
- WHEN a done task's commits rename or delete a file and a doc still names its old path
- THEN that doc is flagged "may be outdated" with the task and the old → new path (doc header, /docs check panel, `vibedoc_check_docs`), and the flag clears once the doc no longer names the old path
### S2: Fix docs
- WHEN the user clicks Fix docs on a flagged doc
- THEN the agent chat gets a prompt naming the doc, the task, the old → new paths and the doc's other lint issues, and the agent's `vibedoc_propose_edit` with the corrected path fixes the doc on Accept
