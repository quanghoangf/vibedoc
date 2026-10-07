# R089: Richer markdown
**Parent:** R003
**Status:** planned
**Order:** 190
**Tasks:** —

Docs get callouts, tabbed code and collapsible sections that still read well on GitHub and in any agent's raw view. Adapted from Fern's Callout, CodeGroup and Accordion components, using plain markdown instead of MDX.

**In scope:** GFM alerts `> [!NOTE|TIP|IMPORTANT|WARNING|CAUTION]` as a `marked` extension (pure `src/lib/md-alerts.ts`) styled with the theme tokens; consecutive fences with `title="…"` grouped into a tab group (`role=tablist`, arrow keys); `<details>/<summary>` styled as an accordion; editor toolbar inserts for callout and details
**Out of scope:** MDX, `:::` directives, Cards / Steps components, any syntax GitHub can't show sensibly
**Done when:** a doc with each of the five alerts, a pnpm/npm code group and a details block renders correctly in VibeDoc and still reads correctly on GitHub

## Scenarios
### S1: Callouts
- WHEN a doc contains `> [!WARNING]` followed by text
- THEN VibeDoc renders a warning callout with its label, in light and dark themes
### S2: Code tabs
- WHEN a doc has two fences in a row titled "pnpm" and "npm"
- THEN they render as one block with two tabs, switchable by click and arrow keys
### S3: Details
- WHEN a doc contains `<details><summary>More</summary>…</details>`
- THEN it renders collapsed with a styled summary row that opens on click
