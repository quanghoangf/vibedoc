---
target: R056 doc-link surfaces (/graph + docs link UI)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/app/(app)/graph/page.tsx"
target_fingerprint: "sha256:c74b46586ab3d7f1fcb9a5fb396745c5e28ddb66bf04f13f52999283141aa160"
target_path: /Users/hoangquangnguyen/work/vibedoc/src/app/(app)/graph/page.tsx
timestamp: 2026-10-02T14-12-56Z
slug: src-app-app-graph-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser), run inside workflow wf_a66ac47f-36f after T108–T112

## Design Health Score — 30/40 (Good)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Recent lights 16 files and names none |
| 2 | Match System / Real World | 3 | "Focus Off 1 2" unexplained; "Stale paths" jargon |
| 3 | User Control and Freedom | 3 | Layered Esc, URL state, Fit replays; hub select never frames its labels |
| 4 | Consistency and Standards | 3 | Broken rows line-through vs DESIGN dashed; "Graph" vs "Link graph" |
| 5 | Error Prevention | 3 | Counts honest now; search matches paths ("roadmap" → 58) |
| 6 | Recognition Rather Than Recall | 2 | All kinds / Recent / phone default fit with 0 labels |
| 7 | Flexibility and Efficiency | 4 | /, Enter framing + stepping, arrows, o, deep links, Show in graph |
| 8 | Aesthetic and Minimalist Design | 3 | Legend repeats chip shapes; edges strike through labels |
| 9 | Error Recovery | 3 | Error card + Retry + details; broken rows open at line |
| 10 | Help and Documentation | 3 | kbd strip, / hint, ? Graph section; Focus unexplained |

## Design Specificity Verdict
Specific: shapes name kind, done hollow grey, mono ids, hairline grid, hue-independent double ring, honest counts, mono UNLINKED shelf. The force map itself is borrowed; the chrome makes it VibeDoc's. Detector: CLI 0; overlay /graph 28 (legend/id 10px mono, edge-hit-path occlusion false positives), all kinds 189 (165 hidden id spans), /docs 403 (prose teal code + th 10px, pre-existing). Objective: all hit pads ≥24 screen px; card Clear 18×18 and Focus 1/2 under 24; selected edges in light with green accent 2.28:1 (uses --color-accent, not --color-accent-edge); 0 labels at fit for all kinds (zoom 0.576) and 390; entrance default 0 long tasks, all kinds one 56ms; 1 graph request per load; no overflow.

## Priority Issues
- [P1] All-kinds, Recent and phone views fit to an unlabeled map — keep top-N labels when far, lit set ignores dot obstacles, Recent frames the touched set. (DocGraph.tsx:495-508, :849)
- [P1] Selecting a hub at fit stacks neighbour label chips — force only the selection when >8 neighbours, or frame the neighbourhood. (DocGraph.tsx:496, :727)
- [P2] Search matches paths, so folder words light whole folders — label/id first, path only with / or . or no hits. (:474-477)
- [P2] Preview card covers the Linked docs rows below — place left of the column. (LinkPreview.tsx:202-206)
- [P2] Selected edges fail 3:1 in light with green/orange accent — use --color-accent-edge. (DocGraph.tsx:549)
- [P3] Broken rows line-through (DESIGN: dashed muted); stale code keeps teal "healthy" hue. (LinkedDocs.tsx:127, globals.css)

## Persona Red Flags
Alex: "roadmap" → 58 matches, no kind prefix, no 1/2 keys for Focus. Sam: Focus/Stale opaque; at 390 chips are shape+count only, doc and task both circles. Solo dev: Recent shows no names; change notch invisible at fit.

## Minor Observations
Edges through label text at full zoom (no backing); Entries 0 chip dead; Recent count rolls without "as of"; phone fit ignores bottom sheet; legend wraps toolbar at 1440 all kinds; kbd strip vs ? wording; card Clear 18×18, Focus 1/2 21–23px.

## Questions to Consider
1. Should Recent be a camera lens (frame + names) instead of a dimming filter?
2. May a hub selection at fit move the camera?
3. Explicit search scope or kind prefixes (t:, r:)?
