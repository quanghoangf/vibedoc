# R083: Teaching empty states
**Parent:** R002
**Status:** in-progress
**Order:** 350
**Tasks:** T290, T291, T292, T293, T294

Each empty page tells the user what fills it and gives the one action that does, so a blank page shows the next step.

**In scope:** board, roadmap, memory, test review, evidence, graph, activity and chat: one sentence on what appears here and why it matters, plus one primary action (button, or the exact `/vibedoc:*` command to copy); the text changes when the agent isn't connected yet (link to Connect); Vietnamese and English
**Out of scope:** sample data on empty pages (that's R085), tooltips and tours
**Done when:** every `(app)` page shown for an empty project has a "what fills this" line and one action, checked across the full route list

## Scenarios
### S1: What fills this page
- WHEN the user opens any page of an empty project
- THEN it says in one sentence what appears there and why it matters, with one primary action (a button, or a `/vibedoc:*` command to copy)
### S2: Agent not connected
- WHEN no agent has called VibeDoc yet and the page's action needs the agent
- THEN the empty state says the agent isn't connected and links to Connect
### S3: Agent connected
- WHEN an agent has called VibeDoc
- THEN the connect line is gone and the page's own action shows
### S4: Vietnamese
- WHEN the language is Tiếng Việt
- THEN every empty state reads in Vietnamese, with commands left as typed

