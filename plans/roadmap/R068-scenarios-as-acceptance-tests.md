# R068: Scenarios as acceptance tests
**Parent:** R002
**Status:** planned
**Order:** 230
**Tasks:** T190, T191, T192, T193

An epic's "Done when" is written as WHEN/THEN scenarios that seed its tasks' test checklists, so the evidence report proves the epic's promise and not just each task's own idea of done.

**In scope:** scenarios on an epic (written by hand or proposed during breakdown); breakdown seeds each task's test checklist from the scenarios it covers; a coverage check before work starts (scenario with no task, task tied to no scenario); an epic view of scenario → task → latest evidence result
**Out of scope:** the cross-task regression suite (R064), changing how tests run (R061)
**Done when:** breaking down an epic with three scenarios yields tasks whose checklists cover all three, and the epic shows each scenario as passed, failed or unproven
