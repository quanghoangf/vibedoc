# R063: Honest tests
**Parent:** R003
**Status:** done
**Order:** 110
**Tasks:** T167, T168, T169, T170, T171

Since humans review evidence and not test code, VibeDoc checks that each test really asserts the expected result, so a test can't pass "for show".

**In scope:** flag steps with no assertion or an assertion unrelated to the checklist's expected result, flag tests that pass with the feature removed or stubbed, show "unverified" next to such items in the evidence doc and the review
**Out of scope:** full mutation testing, judging code quality of the app itself
**Done when:** a spec with an empty or trivial assertion is flagged before the task can show as automatically verified
