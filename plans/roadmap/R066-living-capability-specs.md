# R066: Living capability specs
**Parent:** R002
**Status:** planned
**Order:** 210
**Tasks:** T181, T182, T183, T184, T185

Each capability (board views, memory, roadmap…) gets one doc that says what it does today, as requirements with WHEN/THEN scenarios, so humans and agents stop rebuilding current behaviour from old tasks and MEMORY.md (the spec-anchored idea from OpenSpec's `specs/`).

**In scope:** one spec doc per capability (requirement + scenarios, plain markdown) viewable and editable like any doc; a draft spec bootstrapped from a capability's done epics, tasks, docs and memory for the human to review; the agent gets the related requirements when it reads or claims a task; specs show in the doc link graph
**Out of scope:** changing specs through epics (R069), spec-as-source / generating code from specs, required specs (a task never needs one)
**Done when:** for one existing capability, a reviewed spec exists and an agent claiming a task in that area sees its requirements without being told where to look
