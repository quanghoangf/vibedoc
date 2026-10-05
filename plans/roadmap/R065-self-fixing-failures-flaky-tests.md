# R065: Self-fixing failures & flaky tests
**Parent:** R004
**Status:** done
**Order:** 90
**Tasks:** T176, T177, T178, T179, T180

A failing test goes straight back to the agent with the evidence, and flaky tests are recognised instead of crying wolf.

**In scope:** a failed run sends the task back with the failing step, screenshot and error, retry-and-compare to mark a test flaky, flaky tests shown separately and not counted as broken, a cap on automatic fix attempts before a human is asked
**Out of scope:** auto-merging fixes, quarantining tests without a human
**Done when:** a deliberately broken step returns the task to the agent with its screenshot, and a randomly failing test is labelled flaky after retries
