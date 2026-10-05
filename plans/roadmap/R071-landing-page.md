# R071: Landing page
**Parent:** R002
**Status:** in-progress
**Order:** 240
**Tasks:** T201, T202, T203, T204, T205, T206, T208, T207

A public site where a newcomer understands VibeDoc in 30 seconds, sees it working, and leaves with an install command copied, so installs and GitHub stars grow beyond people who find the README.

**In scope:** standalone landing page with a hero, the plan → build → prove → review loop in one visual, a short video of an agent moving tasks live plus a link into the read-only demo (R042), install tabs with one-click copy, GitHub star count and link, links to docs and changelog
**Out of scope:** pricing or sign-up, a hosted multi-user version, blog
**Done when:** the README and the npm page link to the site, and a visitor can copy an install command and open the live demo from the first screen

## Scenarios
### S1: Copy an install command
- WHEN a visitor picks an install tab (npx, npm, Homebrew, AI assistant) and clicks copy
- THEN that exact command is on their clipboard and the button confirms it
### S2: See it working
- WHEN a visitor plays the demo video or opens the live demo
- THEN they see an agent's task move across the board and the read-only demo opens without installing anything
### S3: Find the next step
- WHEN a visitor reaches the end of the page
- THEN they can go to the docs, the changelog and the GitHub repo (with its star count)
