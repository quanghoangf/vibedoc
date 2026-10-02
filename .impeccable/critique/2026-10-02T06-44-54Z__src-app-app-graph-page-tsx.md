---
target: R056 doc-link surfaces (/graph + docs link UI)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/app/(app)/graph/page.tsx"
target_fingerprint: "sha256:c74b46586ab3d7f1fcb9a5fb396745c5e28ddb66bf04f13f52999283141aa160"
target_path: /Users/hoangquangnguyen/work/vibedoc/src/app/(app)/graph/page.tsx
timestamp: 2026-10-02T06-44-54Z
slug: src-app-app-graph-page-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 22/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Default view hides agent activity; ping lasts 1.5s and leaves no trace |
| 2 | Match System / Real World | 3 | AGENTS.md labelled by its first sentence; CHANGELOG node "1.10.0 (2026-09-30)" |
| 3 | User Control and Freedom | 3 | Esc steps back, Fit replays, drag springs home, URL state |
| 4 | Consistency and Standards | 2 | LinkedDocs epics get Flag not StatusIcon; broken count red on /docs, muted on /graph; green accent ≈ Done teal |
| 5 | Error Prevention | 2 | Stale detector flags placeholders (`<slug>`), relative mentions, spec examples |
| 6 | Recognition Rather Than Recall | 1 | Tab/Enter/O/arrows only in sr-only HINT; `?` sheet lists only / and Esc |
| 7 | Flexibility and Efficiency | 3 | Focus, kind chips, URL state; search doesn't fit to matches |
| 8 | Aesthetic and Minimalist Design | 2 | Orphan ring forces fit out; core labels collide |
| 9 | Error Recovery | 3 | Error card + Retry; hidden-selection Show; raw "Failed to fetch" |
| 10 | Help and Documentation | 1 | No visible interaction legend; no-kinds state has no button |

## Design Specificity Verdict
~70% authored (ruled grid, shape=kind/colour=status, mono ids, honest counts, broken/stale vocabulary, hub bloom), ~30% generic hairball that doesn't answer "what are my agents doing". Detector: CLI 0 in targets. Overlay /graph 46 (tiny-text 17, undersized 13, occlusion 10 — 8 false positives from edge hit paths, 2 real dot-over-label), all-kinds 955 (713 = one teal token over-counted 4×), /docs 362 (318 prose inline code). Objective: Done teal dots 1.78:1 in light theme (FAIL 3:1); labels render ~7.2px desktop / ~3.9px mobile; hit targets 8–16px at fit zoom; dropdown menu item focus 1.05:1; LinkPreview never opens when Tab scrolls the link into view; entrance frames 17ms default, one 109ms task after the unfold on all-kinds; 1 graph request per load; no edges in tab order; no overflow at 390.

## Priority Issues
- [P1] Labels illegible and hit targets tiny at fitted zoom; orphans waste the fit. Gate labels on rendered px, fit to the main component and shelve orphans, fit search to matches, keep hit areas ≥24 screen px. → layout
- [P1] Broken/stale noise: 63 stale mostly placeholders / relative mentions / spec examples. Skip `<…>`/`@` paths, resolve unique basenames, ignore fenced examples; sort/collapse menu; consider stale only on /docs. → harden/distill
- [P1] Colour spent on Done and fails in light: Done teal 1.78:1; green accent ≈ Done. Draw done/cancelled as Pencil Grey hollow, keep active hues; hue-independent selection; light-theme teal token. → colorize
- [P1] Keyboard model invisible to sighted users. kbd strip in the card, graph rows in `?` sheet, `/` hint in search. → clarify
- [P2] Link UI drift: epic Flag vs StatusIcon, red vs muted broken, preview card wider than the column and instant on Tab-through, preview never opens on Tab-scroll (capture scroll listener), menu item focus invisible, no "Show in graph" from a doc. → polish

## Persona Red Flags
Alex: Enter-twice/O undiscoverable; no Show in graph; no next-match key; matches unreadable.
Sam: nodes not announced as selected; 36–192 alphabetical stops, no skip to toolbar/card; preview role=tooltip for rich content.
Solo dev supervising agents: nothing shows what an agent touched beyond a 1.5s ping; 63 stale cries wolf; map mostly Done.

## Minor Observations
Label fallback should prefer file name over first sentence; error card hides toolbar; no-kinds needs a "Show docs" button; mobile card covers top third; focus + hover double highlight; legend lacks review/paused; "Linked docs" heading covers tasks/epics; "/docs 192 docs" vs graph "Docs 31"; LinkedDocs h4 skips h3; unfold class removal causes a 109ms task on all-kinds.

## Questions to Consider
1. Should /graph open on what changed today (agent-touched lit, rest Pencil Grey)?
2. Is "stale paths" a graph concern or a doc lint for the agent's to-do via MCP?
3. Would a ranked list (most-linked, orphans, broken) beside the canvas serve better than the canvas alone?
