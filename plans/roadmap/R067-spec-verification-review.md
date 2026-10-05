# R067: Spec verification review
**Parent:** R002
**Status:** planned
**Order:** 220
**Tasks:** T186, T187, T188, T189

Before a human reviews a finished task, an agent checks the change against what was asked (the task's acceptance criteria, the epic's "Done when", the capability spec when one exists, and the project's conventions) and lists what is missing or wrong, so "marked done" can't hide "not actually built".

**In scope:** a findings list per task grouped Critical / Major / Minor, each pointing at the criterion it fails; findings shown on the task and in the review flow; one action sends selected findings back to the agent as a fix request; findings marked outdated when the code changes
**Out of scope:** judging test quality (R063), reviewing evidence screenshots (R062), general code style review
**Done when:** a task finished with one acceptance criterion skipped gets a finding naming that criterion, and sending it back leads the agent to fix it
