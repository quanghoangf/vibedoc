# R092: Doc upkeep agent
**Parent:** R004
**Status:** planned
**Order:** 130
**Tasks:** —

Docs stop drifting from the code: when a task is done, docs that mention files its commits changed are flagged, and one click asks the agent to propose fixes. Adapted from Fern Agent, which fixes docs from reader signals.

**In scope:** map a done task's commits (`git log --grep=<id>`, as in verify context) to docs that reference the changed files; a "may be outdated" flag on those docs; Fix docs → `askAgent()` with R088's lint + the diff → `vibedoc_propose_edit`
**Out of scope:** scheduled runs, editing without Accept
**Done when:** finishing a task that renames a file flags the doc mentioning it, and Fix docs proposes the corrected path
