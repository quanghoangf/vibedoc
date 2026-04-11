# VibeDoc Roadmap

This is a directional roadmap — not a schedule or a promise. Items move as priorities shift.

---

## v1.x — Shipped

The full v1 feature set is complete and stable.

- Kanban board (task cards, columns, status tracking)
- Docs viewer with markdown rendering
- Live activity feed (SSE, no polling)
- Memory tab (session handoff via `MEMORY.md`)
- File explorer (treemap, tree, heatmap views + AI descriptions)
- 21 MCP tools for AI agents
- Document registry (`REGISTRY.md`) with annotations
- Context bundler (`vibedoc_get_context`)
- ADR logging (`vibedoc_log_decision`)
- CLI launcher (`npx vibedoc`) with auto port selection
- Multi-project switcher
- Setup wizard (first-run)
- Command palette
- Agent config view
- Backlinks panel
- Doc outline panel
- Editor toolbar / tabs

---

## Near-term — v1.x patches

Small, self-contained improvements that don't need a major version.

- **Drag-and-drop kanban** — drag cards between columns to move task status
- **Inline task editor** — edit title, description, phase, and size in the detail panel without leaving the board
- **Multi-project depth limit** — the current sibling-scan is naive; add a smarter discovery strategy
- **`vibedoc --version` flag** — show the installed version from the CLI

---

## Medium-term — v2.0

Larger features that may require API or architecture changes.

- **Plugin system** — let projects register custom MCP tools via a `vibedoc.config.js` file
- **Theme customization** — light mode + custom accent colors
- **Task creation UI** — create tasks directly from the browser (currently AI-only via MCP)
- **Git integration** — show recent commits alongside tasks; link commits to task IDs
- **Improved search** — semantic/fuzzy search across docs, not just substring match

---

## Long-term / ideas

Speculative — not committed.

- **VS Code extension** — open VibeDoc panel inside the editor
- **AI-generated task breakdowns** — paste a feature spec, get a set of task files
- **Team mode** — optional backend for shared state across machines (currently single-user, local only)
- **Export** — generate a static HTML snapshot of the docs for sharing

---

## Not planned

To keep VibeDoc focused and local-first:

- No database (file system is the source of truth)
- No cloud sync or accounts
- No paid tier
