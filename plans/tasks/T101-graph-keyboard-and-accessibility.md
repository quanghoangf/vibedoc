# T101: Graph keyboard path and accessibility
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T098
**Done:** 2026-10-01

## Goal
/graph is fully usable from the keyboard and a screen reader. Today the critique's P0: React Flow edges are tab stops (831 at 185 nodes), nodes show no focus, and Enter does nothing.

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md` (P0, Sam persona). Impeccable refs: `.claude/skills/impeccable/reference/harden.md`, `craft-floor.md`; design system in `DESIGN.md` (focus halo `0 0 0 3px rgb(var(--rgb-accent) / 0.15)` + accent/60 border).
- Code: `src/components/graph/DocGraph.tsx` (onNodeClick mouse-only ~:258, canvas wrapper aria-label on role-less div ~:251, DotView ~:69–79, search Enter ~:200).

## Scope
- [ ] `edgesFocusable={false}`; nodes stay focusable in a sensible order (by label).
- [ ] Node keyboard: Enter/Space selects (same as click), `o` or Enter on an already-selected node opens it (useOpenNode). Arrow keys move focus to the nearest visible neighbour in that direction (fallback: next by label).
- [ ] Visible focus: the focus halo on the dot + label (`.react-flow__node:focus-visible`), never the browser default outline.
- [ ] aria: each node `aria-label` = "<kind> <id?> <label>, N links"; canvas wrapper `role="application"` with `aria-roledescription="link graph"` and short usage hint (`aria-describedby`); selection card in a polite live region so it's announced.
- [ ] Keys: `/` focuses #graph-search, Esc clears search → then selection → then blurs; Enter in search selects the first match AND moves focus to its node. Register in the `?` help sheet like other page keys (`src/lib/shortcuts.ts`, keep `shortcuts.check.mts` green).
- [ ] Hit targets: each node gets an invisible hit area ≥24×24px (padding on the node wrapper), dot size unchanged.

**Out of scope:** colours/shapes (T103), camera behaviour (T102), motion (T105).

## Acceptance criteria
- [ ] From #graph-search, Tab reaches the first node in 1 step; no edge is ever focused.
- [ ] Focused node shows the accent halo in dark and light theme.
- [ ] Enter selects (card opens, URL ?node= updates), Enter again / `o` opens the file; arrows walk neighbours.
- [ ] `/` focuses search from anywhere on /graph; Esc steps back as described.
- [ ] Screen reader name of a node reads kind, label and link count (check via Playwright `accessibleName`).

## Verify
```bash
pnpm build && pnpm lint   # no new errors vs baseline
node src/lib/shortcuts.check.mts
# Playwright: tab order + Enter/o/arrows/Esc on /graph at 1440 and 390 widths
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] On /graph click into "Find a file…", press Tab once → the first node (by label) gets an accent halo on its dot and label; keep pressing Tab → only nodes take focus, never a line
- [ ] With a node focused press Enter → the card opens top right, the URL gets ?node=…; press Enter again → the file opens (doc in /docs, task on /board)
- [ ] Focus a node and press o → the file opens; back on /graph press the arrow keys → focus moves to the nearest linked file in that direction (or the next file by name when none)
- [ ] Press / anywhere on /graph → the search box is focused; type a name and press Enter → the first match is selected, centred and focused
- [ ] Press Esc repeatedly → first the search clears, then the selection card closes, then focus leaves the graph
- [ ] Switch to light theme (Settings → Appearance) and Tab to a node → the halo is still clearly visible
### Regression risk
- [ ] Mouse: click a node selects it, double-click opens it, click the empty canvas clears the selection, pan/zoom still work
- [ ] `/` on /docs and /board still focuses their own search, and the ? help sheet lists the new Graph keys
