# R085: Demo playground
**Parent:** R003
**Status:** in-progress
**Order:** 150
**Tasks:** T330, T331, T332, T333, T334

People can see VibeDoc at its best in seconds, before they connect it to their own repo. Many of them won't do that until they've seen the value.

**In scope:** `vibedoc --demo` (and a "Try the demo" link on the site and the welcome) opens a sample project with a roadmap in progress, tasks across every status, agent chats, test runs with evidence videos, memory entries and a doc graph; it runs in a throwaway copy, so nothing touches the user's files; a clear "Demo" banner with "Use VibeDoc on my project"
**Out of scope:** a hosted online demo, live agent runs inside the demo
**Done when:** on a machine with no project open, one command shows a populated board, a playable evidence video and the memory graph, and closing it leaves no files behind

## Scenarios
### S1: One command
- WHEN the user runs `vibedoc --demo`
- THEN the browser opens a populated sample project with a Demo banner
### S2: Nothing touched
- WHEN the user edits or moves things in the demo and quits
- THEN no file outside VibeDoc's temporary demo copy has changed
### S3: Switch to real use
- WHEN the user clicks "Use VibeDoc on my project"
- THEN they get the command for their own repo
