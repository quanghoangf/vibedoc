# R064: Regression suite
**Parent:** R004
**Status:** planned
**Order:** 80
**Tasks:** T172, T173, T174, T175

Tests from finished tasks keep protecting their features, so a new change that breaks an old feature is caught and traced to the task that owned it.

**In scope:** all task specs form one suite, run all or only those related to the changed area, a report listing which old tasks broke with their evidence, a suite health view
**Out of scope:** CI pipelines, cross-browser matrices
**Done when:** breaking a feature from an earlier done task makes the suite run name that task with a failing screenshot
