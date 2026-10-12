# Writing visually

Docs, epics and tasks that are mostly prose are slow for a person to scan. Where the content has a shape, show it. The **text stays the source of truth**: a Mermaid fence or a plain list with a comment marker reads fine on GitHub, in a diff, and for any agent, and VibeDoc draws it. Never write HTML or SVG diagram files.

Type guidance adapted from [diagram-design](https://github.com/cathrynlavery/diagram-design) (MIT): pick the type by the question the reader asks.

| The reader asks | Use |
|---|---|
| In what order do things happen? | `<!-- vibedoc:steps -->` (3–6 steps) or a Mermaid `flowchart` (when it branches) |
| Who calls whom, in what order? | Mermaid `sequenceDiagram` |
| What states does it move through? | Mermaid `stateDiagram-v2` |
| What is the data shape? | Mermaid `erDiagram` |
| Which option, and what does each cost? | `<!-- vibedoc:compare -->` (2–3 options) |
| What are the parts? | `<!-- vibedoc:cards -->` |
| When does what land? | `<!-- vibedoc:timeline -->` |

## Visual blocks

A comment marker on the line above a plain list. Each item: a **bold title** (an emoji at its start becomes the icon), then ` — ` and one line; lines indented under it are muted detail. `compare` items take nested bullets as their points. In a `timeline`, the title is the date or phase, and only an item titled with the word "Now" gets the accent.

```md
<!-- vibedoc:steps -->
1. **Claim** — the agent takes the next ready task.
2. **Build** — inside the task's scope only.
3. **Prove** — Verify passes, then the report.
```

## Rules

- **Small.** At most 7 nodes for a quick read, 12 at the very most. Split a bigger picture, or link to /graph.
- **One accent.** In a flowchart, `class X accent` marks the one node that matters; nothing else is coloured.
- **Only where it earns its place.** A three-sentence paragraph stays a paragraph. One visual per section at most.
- **Labels are short** (2–5 words); the prose around the visual carries the nuance.
- **Check it renders:** `vibedoc_check_docs { "path": … }` doesn't parse Mermaid, so open the doc in VibeDoc once; a broken diagram shows its error in place.
