# R045: Safe memory updates
**Parent:** R002
**Status:** planned
**Order:** 120
**Tasks:** T123, T124, T125, T126, T127

When an agent writes its session handoff, the notes people wrote by hand stay put, and the previous version can be brought back. Today every update rewrites the whole MEMORY.md, so custom sections like conventions are lost.

**In scope:** agents update individual sections, not the whole file; sections the template doesn't know about are kept; each earlier version is kept and can be restored
**Out of scope:** splitting memory into separate entries (R046); editing in the UI (R047)
**Done when:** an agent's handoff leaves a hand-written section untouched, and the version from before that handoff can be restored
