---
target: app shell
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/components/layout"
timestamp: 2026-09-30T03-25-52Z
slug: src-components-layout
---
# Critique: VibeDoc app shell (src/components/layout)

Method: dual-agent (A: design review · B: detector + browser on :3100 working tree). :52209 was a stale npx 1.6.0 install and was discarded.

## Design Health Score: 20/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | 6px grey unlabelled live dot, hidden < sm; no disconnected state (no es.onerror in AppContext.tsx:100) |
| 2 | Match System / Real World | 3 | Agent / Agent chat / Agents: three names for one concept |
| 3 | User Control and Freedom | 2 | Global single-key shortcuts hijack ⌘C, ⌘B, ⌘D |
| 4 | Consistency and Standards | 2 | Palette 4 pages, shortcuts 5, sidebar 8; "Search…" only searches docs |
| 5 | Error Prevention | 1 | Letter keys inside CodeMirror navigate away mid-edit |
| 6 | Recognition Rather Than Recall | 2 | Shortcuts only in hidden `?` sheet |
| 7 | Flexibility and Efficiency | 2 | ⌘K can't reach tasks, epics, chats, 5/8 pages, project switch |
| 8 | Aesthetic and Minimalist | 3 | Two solid-accent CTAs compete |
| 9 | Error Recovery | 1 | Palette catch{} shows "No docs found" on failure; error chat = unlabelled red dot |
| 10 | Help and Documentation | 2 | `?` sheet undiscoverable |

## Design Specificity
Mostly generic shadcn sidebar-07 shell. Authored parts: sidebar Agents group (needs you → running → recent) and the waiting badge, both subordinate to an 8-item flat nav. Detector CLI: 0 shell findings. Browser (:3100): logo gradient tile 1.8:1 + ai-color-palette (AppSidebar.tsx:53) real; ⌘K kbd 3.8:1 (AppHeader.tsx:75) real; 10px mono badges, header nested-cards, sidebar layout-transition = false positives. Palette 0 findings.

## Priority Issues
- [P0] Global shortcuts ignore modifiers & contenteditable — (app)/layout.tsx:66-72. ⌘C blocked + opens chat; ⌘B toggles sidebar AND goes to /board; "b" in CodeMirror navigates. Fix: bail on meta/ctrl/alt, defaultPrevented, isContentEditable/[role=textbox]/select/.cm-editor. → harden
- [P1] ⌘K is doc search, not a command palette — CommandPalette.tsx:31-37,57. Add grouped Navigate/Tasks & epics/Chats/Docs/Actions with kbd hints; pin top-[20%]; show fetch errors. → clarify
- [P1] Live/agent status too quiet — AppHeader.tsx:60-66, AppContext.tsx:100-119, StatusMarker.tsx. Header strip "● live · 2 running · 1 needs you"; disconnected state; aria-labels; review vs running vs done colour collision under green accent. → harden
- [P2] Contrast — muted #6b6b80 3.5–3.8:1; muted/60 ≈2.1:1; white on accent 3.96 violet / 2.28 green / 2.8 orange; logo 1.8:1. Lift --rgb-muted ≈140 140 160; per-accent --rgb-accent-fg; flat logo. → colorize
- [P2] Flat generic nav IA — AppSidebar.tsx:22-31; group Plan & supervise / Reference, Settings to footer; project switcher colour-only active + clipped paths (ProjectSwitcher.tsx:41-44). → layout

## Persona Red Flags
- Alex: ⌘C/⌘B/⌘D hijacked; no Roadmap key; no task-by-ID in ⌘K; ⌘P vs ⌘K overlap; no next-waiting-chat key.
- Sam: no skip link; colour-only chat status; live dot no text/aria-live; palette lacks role=option/aria-activedescendant; active project colour-only.
- Solo dev with 3 agents: nothing in header says "3 running"; collapsed rail shows waiting only, no errors; grey dot reads dead.

## Minor Observations
Manual tests badge lost when collapsed; LoadingScreen doesn't name repo; Connect help sentence all-link and wraps at 320px; palette focus ring clipped; mobile Agent button icon-only with title only; Help (?) unreachable by pointer.

## Questions to Consider
- Why do eight page links outrank the agents you're supervising?
- Should the header right side be a live agent strip instead of a docs-only search pill?
- If T064 in ⌘K doesn't open T064, is it keyboard-first or keyboard-available?
