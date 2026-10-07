# R086: First-run feedback
**Parent:** R003
**Status:** planned
**Order:** 160
**Tasks:** T350, T351, T352, T353

Learn which setup step loses new users, so onboarding fixes go where they matter most. Right now only site visits are counted.

**In scope:** off by default; asked once, in plain words, with exactly what would be sent; anonymous step events only (started, agent connected, first roadmap, first task done; no project names, paths or content); a one-line "Stuck? Tell us" link that opens a prefilled GitHub issue; turn on or off any time in Settings
**Out of scope:** usage analytics beyond the first-run steps, session recording, anything sent without consent
**Done when:** an opted-in first run shows up as a step funnel the maintainer can read, and an opted-out run sends nothing

## Scenarios
### S1: Asked once
- WHEN a project is opened in VibeDoc for the first time
- THEN a card asks in plain words whether to send first-run steps, shows exactly what would be sent, and doesn't come back once answered
### S2: Opted-in funnel
- WHEN the user opts in and goes through start → agent connected → first roadmap → first task done
- THEN one anonymous event per step is sent (no project names, paths or content) and the maintainer reads them as a step funnel
### S3: Opted out sends nothing
- WHEN the user declines, or never answers
- THEN no request leaves VibeDoc for the analytics host
### S4: Stuck link
- WHEN the user clicks "Stuck? Tell us"
- THEN a GitHub issue opens prefilled with the VibeDoc version, OS and the last step reached, and nothing from the project
### S5: Change it in Settings
- WHEN the user turns first-run feedback off (or on) in Settings
- THEN sending stops (or starts) from the next step on
