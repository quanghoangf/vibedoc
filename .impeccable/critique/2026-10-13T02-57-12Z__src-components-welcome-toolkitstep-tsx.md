---
target: R098 toolkit UI (welcome step + chat card)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/components/welcome/ToolkitStep.tsx"
target_fingerprint: "sha256:5713fafc9fe50fba971c42fea3db873c03c49701ef1422bd1f455967312c09d4"
target_path: /Users/hoangquangnguyen/work/vibedoc/src/components/welcome/ToolkitStep.tsx
timestamp: 2026-10-13T02-57-12Z
slug: src-components-welcome-toolkitstep-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser evidence)

# Critique: R098 toolkit UI (welcome "Pick your toolkit" step + chat toolkit card)

Targets: src/components/welcome/ToolkitStep.tsx, src/components/toolkit/{ToolkitPicker,ToolkitBody,ToolkitConfirmDialog}.tsx, src/components/chat/ToolkitCard.tsx

## Design health: 26/40 (acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No per-row installing state; ✓ results not announced |
| 2 | Match real world | 3 | "Fits: git repo" reads as a tag |
| 3 | User control | 3 | Cancel/Esc, nothing runs before confirm |
| 4 | Consistency | 2 | Native checkboxes; accent used for "Fits"; raw ids in sans |
| 5 | Error prevention | 3 | Dialog lists marketplace add per plugin even when skipped |
| 6 | Recognition | 3 | No count on the button |
| 7 | Efficiency | 2 | No preselect of fits, long tab path |
| 8 | Minimalist | 2 | Cards in card, 774px tall, Fits on 6/8 rows |
| 9 | Error recovery | 3 | Real stderr + commands; stderr uncapped |
| 10 | Help | 3 | Scope explained; no "Optional" marker |

## Specificity
~70% VibeDoc: copy, R081 dialog/CommandBlock, mono commands. Generic structure: bordered cards inside a bordered section, white native checkboxes, accent Fits line. Detector: CLI 0 findings; overlay nested-cards (ToolkitStep.tsx:16, ToolkitCard.tsx:25 around ToolkitPicker.tsx:51, 3 deep in chat) = real; ai-color-palette on teal Installed badges = false positive (project token).

## Priority issues
1. [P1] Focus lost when the confirm dialog closes (capture Esc listener unmounts before Radix FocusScope restores); initial focus on first Copy button. Fix: return focus to Install selected, autofocus Cancel.
2. [P1] Install progress/results invisible: no per-row installing state, no live region; reduced motion freezes the spinner. Fix: polite status line "Installing 2 plugins…" → "Installed 2 · 1 failed"; muted "installing…" on picked rows.
3. [P2] Fits signal diluted and on the accent. Fix: muted mono `fits · git repo`; preselect fitting, uninstalled items on the welcome.
4. [P2] Hierarchy/density: one ruled divide-y list (no card in card), fold installed into one line, mark step Optional, count in the button "Install 2".
5. [P3] Native white checkboxes (use TestDetail.tsx drawn box), dialog repeats marketplace add per plugin (dedupe), stderr <pre> uncapped.

## Persona red flags
- Alex: ~6 tab stops, focus to body after Esc, first dialog stop is Copy.
- Jordan: 8 unfamiliar names, nothing preselected, step not marked optional.
- Sam: reasons not aria-describedby; installed boxes out of tab order; results not announced; focus lost.

## Minor
Card title vs step title differ; chat Summary raw ids; disabled button looks broken; green accent makes Fits ≈ Installed teal.

## Questions
- Toolkit on the welcome or offered by the agent after the first roadmap?
- One-line default "Install the N that fit" with "Choose…"?
