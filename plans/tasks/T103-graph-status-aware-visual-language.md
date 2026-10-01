# T103: Status-aware visual language for the graph
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** L (half a day)
**Depends on:** T102

## Goal
The graph reads as VibeDoc's lab notebook, not a generic Obsidian clone: kinds by shape, task/epic state in the one status language, accent only for selection and search, contrast that passes. Decision: keep the whole-repo graph and add supervision signals.

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md` (P1 colour/shape, P1 counts, design-specificity verdict). DESIGN.md: Highlighter Rule, One Status Language Rule (`STATUS_META` / `StatusIcon`), Triplet Rule, Shapes (full round only for dots), Flat-At-Rest, Grep Rule. Precedent: `src/components/memory/MemoryGraph.tsx` shows StatusIcon on tasks.
- Impeccable refs: `craft-floor.md`, `polish.md`, `colorize.md` (status only), `clarify.md` for copy.
- Detector: dots/edges 1.46:1 (need ≥3:1 non-text), labels 11px with collisions, node titled with raw markdown ("[1.10.0](https://…").

## Scope
- [ ] Node shapes by kind, all neutral at rest: doc = circle, ADR = square, epic = diamond, task = small circle, entry = ring. Size still by degree.
- [ ] Task and epic dots take their status hue from `STATUS_META` (custom statuses map through their category); others neutral (Pencil Grey). Accent only for selected node, its edges, and search matches. Add owner glyph (Bot/User) to the selected card, and an AgentDot when the item has a chat (`itemAgents` from ChatContext) — supervision at a glance.
- [ ] Contrast: edges and neutral dots ≥3:1 on Ink Black and on paper (light) — use `border-strong`/muted tokens, not border2. Orphans no lower than 3:1.
- [ ] Legend: one compact mono line in the toolbar (shape → kind, "colour = status"), collapsible on mobile.
- [ ] Toolbar: chips `rounded-sm` (not full); chips with 0 items disabled; search width reserved so the match count doesn't shift it; toolbar fits one row at ≥720px and two at 390px.
- [ ] Selected card: 8px radius, Float shadow allowed (it floats), counts reflect **visible** links with muted "+N hidden by filters"; kind + status chip via StatusChip.
- [ ] `kinds` all off → message "Turn on a kind to see files" (not blank).
- [ ] Labels: strip markdown from H1 labels in `docNode()` (`src/lib/doc-links.ts`, add a check case); collision-avoid at fit zoom by hiding labels of lower-degree nodes that overlap a higher-degree one (simple greedy pass over screen boxes); keep the selected/matched labels always.
- [ ] React Flow chrome: Controls restyled as the app's ghost icon buttons; attribution hidden via `proOptions={{ hideAttribution: true }}`; background dots at low contrast or removed (ruled-notebook feel: a faint grid is fine, dotted default is generic).

**Out of scope:** broken-link split (T104), motion (T105).

## Acceptance criteria
- [ ] With all kinds on, a task in progress is amber, done teal, blocked red; ADRs are neutral squares; nothing but the selection uses the accent (check with accent set to green and violet).
- [ ] Edge and dot contrast measured ≥3:1 in dark and light (Playwright computed colours).
- [ ] Card counts equal the edges drawn; hidden ones appear as "+N hidden".
- [ ] No node label contains markdown syntax; no two visible labels overlap at fit zoom on this repo.
- [ ] `node src/lib/doc-links.check.mts` passes with the new label case.

## Verify
```bash
node src/lib/doc-links.check.mts
pnpm build && pnpm lint
# screenshots: /graph default, all kinds, selected, light theme, 390px
```
