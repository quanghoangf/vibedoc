---
target: R056 doc-link surfaces (/graph + docs link UI)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/app/(app)/graph/page.tsx"
target_fingerprint: "sha256:c74b46586ab3d7f1fcb9a5fb396745c5e28ddb66bf04f13f52999283141aa160"
target_path: /Users/hoangquangnguyen/work/vibedoc/src/app/(app)/graph/page.tsx
timestamp: 2026-10-01T10-02-18Z
slug: src-app-app-graph-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 21/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Selected card counts all edges, not visible ones (DocGraph.tsx:209); loading is bare text |
| 2 | Match System / Real World | 3 | "Focus Off 1 2" never says it means neighbourhood depth |
| 3 | User Control and Freedom | 2 | Every SSE event refetches + fitView, throwing away pan/zoom; Esc doesn't clear selection |
| 4 | Consistency and Standards | 2 | rounded-full chips, rounded-xl+shadow card, ADR dots in accent, off-token 150ms fades, raw "✅ Done" emoji in preview |
| 5 | Error Prevention | 2 | Live toggle for "Entries 0"; kinds=none → blank canvas; hidden selection dropped silently |
| 6 | Recognition Rather Than Recall | 2 | Task/epic/entry are identical bg-border2 dots, no legend |
| 7 | Flexibility and Efficiency | 2 | No `/`, Esc, node keyboard nav, or "Show in graph" from a doc |
| 8 | Aesthetic and Minimalist Design | 3 | Flat and restrained; centre labels collide; raw markdown title node |
| 9 | Error Recovery | 1 | Fetch failure shows "No links yet"; "47 broken links" (43 are code mentions) not clickable |
| 10 | Help and Documentation | 2 | Empty state teaches syntax; nothing explains Focus, broken, dot size/colour |

## Design Specificity Verdict
LLM: docs link column (LinkedDocs, line-cited backlinks, StatusIcon, mono paths) is authored for VibeDoc. /graph is a generic Obsidian clone — grey dots, orphan ring, dotted background, pill chips, floating shadow card — and less specific than its own sibling MemoryGraph (which shows StatusIcon on tasks).
Detector: CLI 0 findings (Tailwind-in-cn() is invisible to static scan). Overlay: /graph 42 (tiny-text 20 @DocGraph.tsx:75, text-occlusion 11, undersized-ui-text 8 @:79), all-kinds 165 (157 false positives — hidden labels), /docs 388 (318 ai-color-palette = pre-existing teal inline code; th 10px globals.css:194). Objective: nodes/edges have no focus indicator; 831 tab stops at 185 nodes; task/epic/entry dots and edges 1.46:1 (fail 3:1); hit targets 4–9px; /api/docs/graph fetched twice per load, /api/docs/links three times per doc open; no overflow at 390px; no console errors.

## Priority Issues
- [P0] Graph unusable from keyboard: edges focusable (hundreds of invisible tab stops), no node focus ring, Enter does nothing. Fix: edgesFocusable=false, onNodeKeyDown select/open, focus halo, aria-labels, `/` + Esc. → harden
- [P1] Live updates yank the camera: SSE refetch → new pos → fitView every time. Fix: refit only when visible id set changes and user hasn't moved; flash changed nodes instead. → harden + animate
- [P1] Colour/shape carry no state; accent spent on ADRs; dots/edges 1.46:1. Fix: neutral kinds by shape, task/epic dots in STATUS_META hues, accent only for selection/match, legend, edge/dot contrast ≥3:1. → colorize/distill
- [P1] Counts mislead: all-edge counts, 47 broken mostly code mentions, not clickable, error = empty state. Fix: visible counts + "+N hidden", split broken vs path mentions, clickable broken list, error state with Retry. → clarify
- [P2] Preview card: strips underscores ("vibedocnexttask"), shows raw emoji/checkboxes, pops on sheet autofocus, no aria-describedby. → polish

## Persona Red Flags
Alex: no `/`, Esc, arrow nav; no Show-in-graph; relayout on filter wipes spatial memory.
Sam: 800+ edge tab stops; no node focus; canvas aria-label on role-less div; card not announced; orphan labels ~2.4:1.
Solo dev supervising agents: camera snaps on every task move; graph can't show what agents are touching; constant 47-broken noise; toolbar wraps to 3 rows on mobile.

## Minor Observations
Search box shifts when match count appears; "Linked from" citation repeats the path; header count mixes unique/non-unique; LinkedDocs h4 not Label Caps mono; rows lack transition-colors; React Flow attribution + default Controls skin; double/triple fetches; sheet 500ms ease-in-out off-token; JS fitView/setCenter/scrollIntoView ignore reduced motion.

## Motion Inventory (missing/wrong)
Relayout teleports then camera glides (wrong order) → tween positions on --duration-slow; node fades 150ms off-token while edges snap → one token; selection card/preview card pop in/out with no motion; no update-flash on live change; labels snap at zoom threshold; column toggle reflows instantly; sheet off-token; JS camera/scroll animations not reduced.

## Questions to Consider
1. Should /graph be a supervision view (what agents touched recently, status-coloured) with the whole-repo hairball as opt-in?
2. Is a backticked path mention a link at all, or a separate signal ("docs mention files that no longer exist")?
3. Would a Focus-1 mini graph inside LinkedDocs beat a separate page?
