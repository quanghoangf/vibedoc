---
target: app shell
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/components/layout"
timestamp: 2026-09-30T04-35-26Z
slug: src-components-layout
---
# Critique: VibeDoc app shell, run 3 (src/components/layout)

Method: dual-agent (A: design review · B: detector + browser), working tree :3100.

## Design Health Score: 28/40 (Good; previous 20 → 23)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Terminal agents muted text with no glyph; 2s live glow easy to miss |
| 2 | Match System / Real World | 3 | Roadmap "need attention" vs shell "need you"; g = Chats not mnemonic |
| 3 | User Control and Freedom | 3 | Dismiss has no undo |
| 4 | Consistency and Standards | 3 | Dismissed error stays red in markers; help sheet kbds all accent |
| 5 | Error Prevention | 3 | Guard solid; ⌘P overrides Print silently |
| 6 | Recognition Rather Than Recall | 3 | Hints only on hover; 16 shortcuts |
| 7 | Flexibility and Efficiency | 3 | c ignores the alarm; Connect not keyboard-operable |
| 8 | Aesthetic and Minimalist | 3 | "● · ● 1 error" hard to parse |
| 9 | Error Recovery | 2 | Error announced, never routed to; refresh() failures not shown |
| 10 | Help and Documentation | 3 | Help omits board and chat keys |

## Design Specificity
Authored for VibeDoc (terminal-vs-chat strip, chats-first sidebar, ID-first ⌘K, Connect with claude mcp add + last call, shape-coded markers); frame still stock shadcn. Detector CLI 0 (also --no-config); browser shell findings all false positives. B measured: header "/" and "·" separators 2.82 dark / 2.35 light; light muted passes narrowly (4.59–5.10).

## Priority Issues
- [P1] Chat error counted but not routed; red outlives Dismiss — defaultChat chats.ts:175-178 (needsYou → running → recent), strip onClick AppHeader.tsx:128, palette CommandPalette.tsx:132-134, sidebar recent.slice(0,4) SidebarChats.tsx:33, chatStatus chats.ts:67-75 ignores dismissed/24h. Fix: errors bucket in groupChats after needsYou; use in c/strip/palette/sidebar; marker idle when not actionable. → harden
- [P1] Connect menu not keyboard-operable — plain buttons inside Radix DropdownMenuContent (AppHeader.tsx:196,213); command truncated. Fix: Popover or DropdownMenuItem onSelect copy; wrap command. → harden
- [P2] Strip weight inverted — separator after connection dot; agents need glyph; actionable counts text-txt; aria-label with action (AppHeader.tsx:141-146). → clarify
- [P2] Tab order: strip ~17th stop; skip link skips header (layout.tsx:115-118). → audit
- [P3] Help kbds all accent (layout.tsx:163); Esc row w-12 (:162); g vs c; missing hints for Settings/Chats; separators <3:1. → polish

## Persona Red Flags
- Alex: c not to alarm; empty ⌘K preselects idle chat; command copy mouse-only.
- Sam: Connect trap; strip name lacks action; "Break down R043 R043"; QuickOpen lacks listbox (QuickOpen.tsx:80-98); strip ~17th tab stop.
- Solo dev, 3 terminal agents: muted 11px no motion; tab title counts waiting only (ChatContext.tsx:169); narrow "● · ● 1".

## Minor Observations
Green accent blurs Review/running/Done; collapsed rail stacked tiny dots, no group separators; Connect hidden < md; LoadingScreen blanks shell; empty-projects header no guidance; board at 1440 mostly empty columns (outside shell).

## Questions to Consider
- Why does a healthy connection get colour while working agents don't?
- One needs-you + errored queue with c walking it?
- Board/Roadmap/Chats primary, rest via ⌘K?
