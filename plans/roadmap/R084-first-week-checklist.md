# R084: First-week checklist
**Parent:** R003
**Status:** done
**Order:** 140
**Tasks:** T310, T311, T312, T313

A new user goes through the whole VibeDoc loop once (plan, break down, build, verify) and sees why each step matters. This is what turns a first install into a habit.

**In scope:** a checklist that ticks itself from what actually happened: agent connected → roadmap created → first epic broken down → first task done by the agent → first test run with evidence → first memory entry; each item links to its page or command; visible from the sidebar until finished or dismissed; per project
**Out of scope:** rewards or gamification, team-wide progress
**Done when:** a user who follows only the checklist ends with a done task that has evidence, and every item ticked without them ticking anything by hand

## Scenarios
### S1: Ticks itself
- WHEN the agent marks the user's first task done
- THEN "First task done" ticks without a reload
### S2: Next step is one click
- WHEN the user opens the checklist
- THEN the first unticked item shows its page or the exact command to copy
### S3: Dismiss
- WHEN the user dismisses the checklist
- THEN it doesn't come back for this project
