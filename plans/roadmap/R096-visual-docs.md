# R096: Visual docs
**Parent:** R002
**Status:** planned
**Order:** 370
**Tasks:** T513, T514, T515, T516, T517, T518, T519

Docs today are mostly walls of text. Make them easier to scan for both people and agents: diagrams and visual blocks written in plain markdown (so agents, diffs and GitHub still read them), shown in VibeDoc's own style, and copied out without losing the look — like ChatGPT's visual answers, but the source stays text. Style borrowed from cathrynlavery/diagram-design (one accent, 1px hairlines, no shadows, 4px grid); no HTML/SVG diagram files.

**In scope:** Mermaid themed from DESIGN.md tokens (light + dark) instead of the stock `neutral`/`dark` themes; a diagram viewer (zoom, pan, fullscreen, copy source, parse errors shown inline instead of only in the console); visual blocks — a comment marker `<!-- vibedoc:steps|cards|compare|timeline -->` on a plain markdown list renders as cards / a flow with arrows / two columns / a timeline, while GitHub, the raw view and agents still see the list; Copy that writes `text/html` (rendered, inline styles) and `text/plain` (markdown) so a paste into Notion / Google Docs / Slack keeps the look; editor toolbar inserts for diagram templates (flowchart, sequence, state, ER) and each visual block; the `roadmap`, `breakdown` and `work` skills use diagrams and visual blocks when they write epics, tasks and docs (pick the type, keep it small)
**Out of scope:** embedded HTML/SVG diagram files, a drawing canvas, more than one diagram style, vendoring diagram-design itself
**Done when:** a doc with a Mermaid diagram and each visual block renders in VibeDoc's style in light and dark, still reads as a normal list/code block on GitHub and in `vibedoc_read_doc`, and pasting a copied block into Google Docs keeps its cards

## Scenarios
### S1: Themed diagrams
- WHEN a doc has a ```mermaid flowchart
- THEN it renders with VibeDoc's tokens (hairlines, one accent) in light and dark, matching the rest of the page
### S2: Diagram viewer
- WHEN the user opens a large diagram fullscreen
- THEN they can zoom and pan it and copy its source; a diagram with a syntax error shows the error inline, not a blank box
### S3: Visual blocks
- WHEN a doc has `<!-- vibedoc:steps -->` above a numbered list of bold titles with text
- THEN VibeDoc shows one card per item joined by arrows, and GitHub / `vibedoc_read_doc` still show the numbered list
### S4: Copy keeps the look
- WHEN the user copies a visual block and pastes it into Google Docs or Notion
- THEN the cards keep their layout; pasted into a code editor it is the markdown source
### S5: Insert from the editor
- WHEN the user picks a diagram template or a visual block from the editor toolbar
- THEN the source is inserted at the cursor and the live preview shows it rendered
### S6: Agents write visually
- WHEN an agent runs `/vibedoc:breakdown` or `/vibedoc:work` on work with a flow, states or steps
- THEN the task or doc it writes contains a fitting diagram or visual block instead of only prose
