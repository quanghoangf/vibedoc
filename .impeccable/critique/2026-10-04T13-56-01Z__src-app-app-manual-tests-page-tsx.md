---
target: /manual-tests Test review
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/app/(app)/manual-tests/page.tsx"
target_fingerprint: "sha256:5b5d24e1f37f7ba428d3711eab8b3eb99aaa9f545b651963abaed1e72e0e7233"
target_path: /Users/hoangquangnguyen/work/vibedoc/src/app/(app)/manual-tests/page.tsx
timestamp: 2026-10-04T13-56-01Z
slug: src-app-app-manual-tests-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score: 25/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | No saving/saved state on tick; j/k selection change not announced |
| 2 | Match real world | 2 | Raw markdown backticks + emoji in checklist; step times all 0:00 |
| 3 | User control | 2 | Approve has no undo; failed run on a Done task has no action |
| 4 | Consistency | 3 | Two timelines (native + step track); rows 65px vs 52px spec; emoji |
| 5 | Error prevention | 2 | Approve doesn't show unticked checks / failed run at decision time |
| 6 | Recognition | 3 | j/k hint only on empty pane, never seen on wide screens |
| 7 | Flexibility | 2 | Only j/k and /; no tick/approve/send back/play/next-failure keys; list = 82 tab stops |
| 8 | Minimalist | 3 | Last run "—" in 81/83 rows; manual 0/N everywhere |
| 9 | Error recovery | 3 | Failed-step error block is excellent |
| 10 | Help | 2 | No on-page shortcut strip |

## Priority issues
1. [P0] "Needs you" holds 82/83 tasks (every Done task with unticked checks) — no triage; sidebar 594 badge is noise. Fix: needsMe = failed || review || (unticked checks on a not-done task); badge = failed + review.
2. [P1] A failed run has no next action (T149 Done + failed): add decision bar "Last run failed at step N · Send back to agent (note prefilled with step + Expected/Received) · Open task".
3. [P1] Checklist renders raw backticks and emoji (🤖 ⚠️ 🧪): parse `code` spans, strip status emoji.
4. [P1] Player: native controls + custom track duplicate; track aria-hidden, segments not clamped to video length, 0:00 labels; stage not sticky; failed run doesn't open on the failure frame.
5. [P2] Keyboard stops at the list: roving tabindex, x/a/s/f/space keys, kbd strip, live region; approve gives no feedback or next item.

## Detector
CLI: 2 advisory (design-system-font-size: page.tsx:161 text-[15px], TestDetail.tsx:59 text-[1.35rem]). Browser: 10px UI text (list header, checklist h3s, report footer, kbd), scrubber buttons without accessible name, video without label, gpt-thin-border-wide-shadow on stage, height transition on scrubber. Contrast passes (muted 5.99:1). False positives: em-dash, overused mono, cyan-neon (teal status), shell transitions, ProjectSwitcher truncate.

## Minor
Selected row barely differs from hover; ManualRuling caps at 12; ticking reassurance buried in 10px footer; ReviewActions placed before the evidence; mobile columns squeeze titles, tab strip clips without affordance; run select uses long toLocaleString labels.
