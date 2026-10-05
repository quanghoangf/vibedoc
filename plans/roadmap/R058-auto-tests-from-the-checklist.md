# R058: Auto-tests from the checklist
**Parent:** R002
**Status:** done
**Order:** 180
**Tasks:** T145, T146, T147, T148

The agent turns each task's manual test checklist into a real browser test and runs it before marking the task done, so "done" means "proven" instead of "please click through".

**In scope:** one Playwright spec per task in the target FE repo, every checklist item becomes steps with an assertion on the expected result, the agent runs it in /work-epic before done, the task file links the spec, items without a testable expectation stay manual
**Out of scope:** running tests from the UI (later epic), CI, non-browser tests
**Done when:** an agent finishing a UI task leaves a spec next to the code, the run passes, and the task's checklist shows which items are automated vs still manual
