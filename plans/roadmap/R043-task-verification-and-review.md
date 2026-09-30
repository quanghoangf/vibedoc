# R043: Task verification & review
**Parent:** R003
**Status:** done
**Order:** 40
**Tasks:** T060, T061, T062, T063, T064

After each task, the agent writes a manual test checklist for the human, so it's clear what to click through before trusting 'done', without ever blocking the board.

**In scope:** a manual test report per task (steps, expected result, regression risk, tickable items), a badge on cards, a page listing tasks with untested items, an optional Review column with approve / send back with a note
**Out of scope:** blocking the move to done, running tests inside VibeDoc, CI integration
**Done when:** an agent finishing a task via /work-epic leaves a manual test checklist that shows as a card badge and on the summary page, and ticking items there updates the task file
