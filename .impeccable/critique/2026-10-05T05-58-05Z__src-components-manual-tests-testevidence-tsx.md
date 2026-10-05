---
target: Evidence view
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/hoangquangnguyen/orca/workspaces/vibedoc/UI-critique/src/components/manual-tests/TestEvidence.tsx"
target_fingerprint: "sha256:d18f8bdccf8028b7c2cbc7cd30f4c48096cb37fdece0688794a6f4f29a8f0b1e"
target_path: /Users/hoangquangnguyen/orca/workspaces/vibedoc/UI-critique/src/components/manual-tests/TestEvidence.tsx
timestamp: 2026-10-05T05-58-05Z
slug: src-components-manual-tests-testevidence-tsx
---
# Critique: Evidence view (/manual-tests?view=evidence) — TestEvidence.tsx

Method: dual-agent (A: design review · B: detector + browser overlay)

## Heuristics (20/40, Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | Older run picked from History: nothing below the list says so |
| 2 | Match real world | 3 | Reads like a lab record; same text as EVIDENCE.md |
| 3 | Control & freedom | 2 | Bad/pruned ?run= is a dead end |
| 4 | Consistency | 2 | History twice (nav list + markdown table); 3 status vocabularies; bullets show despite spec |
| 5 | Error prevention | 2 | "5/5 steps" counts run steps, not checklist coverage; ⚠️ missing never totalled |
| 6 | Recognition | 2 | Rows all "passed · 1h ago"; absolute time only in title tooltip |
| 7 | Flexibility | 2 | `v` toggles; no key to step runs |
| 8 | Minimalist | 2 | T181 doc 11,046px; every screenshot/log expanded |
| 9 | Error recovery | 1 | data.error replaces whole view incl. History; raw "Bad run id" |
| 10 | Help | 2 | No-run state gives no next action |

## Specificity
History list + run headline are VibeDoc-native; doc body goes through generic .prose-dark (accent headings, teal code, disc bullets) and reads like a README preview. Detector: CLI 0 findings; overlay 18 in-target hits, all false positives (Reagent Teal tokens, sanctioned 10px label-caps th, segment control/markdown wrapper as "nested cards").

## Priority issues
1. [P1] No verdict / checklist-coverage line; failure buried (T149: Done, 0/10 proven, failed step ~2000px down under "Steps not in the checklist"). Fix: verdict block above History ("❌ Failed at step 2 · 0/10 checks proven · 2 steps unmatched" + jump link); failed/missing first. → clarify, layout
2. [P1] Error/pruned-run dead end (TestEvidence.tsx:77-78). Fix: keep History, "That run isn't kept any more" + Show newest (onRun(null)). → harden
3. [P2] Lost run context: headline lacks "Older run · newest passed 45m ago → Show newest"; add mono absolute time per row. → clarify
4. [P2] Prose fights spec: unlayered `.prose-dark ul {list-style: disc}` + padding (globals.css:195-197) beats Tailwind `[&_ul]:list-none pl-0`; h2/h3 accent (collides with teal under green accent); all inline code teal incl. commits on failed runs; duplicate History table. Fix: evidence prose variant, drop ## History from UI render. → quieter, polish
5. [P2] Doc too long, screenshots mouse-only (img tabIndex -1). Fix: step thumbnails as buttons (RunPlayer pattern), collapse passed-step media, clamp logs ~6 lines. → distill, audit

## Personas
- Alex: no prev/next run key; can't compare runs; video opens raw .webm in new tab; scroll 11k px to failure.
- Sam: Review·Evidence role=tablist without tabpanel/aria-controls/arrow keys; heading order h3 History before h2 Checklist; no live region on run pick; zoom click-only; 156 tab stops before History (inherited list checkboxes).
- Solo dev verifying "done": Done chip + ❌ run with no coverage line; step-name drift silently turns 🤖 checks into ⚠️; no-run state doesn't suggest asking agent for a spec.

## Minor
- Light + green accent: h3 uses raw --color-accent, likely <4.5:1 on white (unmeasured).
- Mobile: sticky decision bar ~15% height, truncates step name; shell span.max-w-[160px] overflows 45px (outside target).
- Long inline-code commands wrap into teal fragments.

## Questions
- Should Evidence be its own view, or should Review lead with verdict + coverage and offer "Copy EVIDENCE.md"?
- Why render structured matchItems rows through markdown instead of native rows sharing Review's status language?
- Should "Done, but newest evidence fails" be a loud state of its own?
