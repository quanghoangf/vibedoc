---
target: app shell
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/components/layout"
timestamp: 2026-09-30T04-05-31Z
slug: src-components-layout
---
# Critique: VibeDoc app shell, second run (src/components/layout)

Method: dual-agent (A: design review · B: detector + browser), working tree :3100.

## Design Health Score: 23/40 (Acceptable; previous run 20/40)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Strip counts only in-app chats; terminal MCP agents read as bare "live" |
| 2 | Match System / Real World | 2 | "live" = SSE in header, in-progress epics on roadmap; "Agents" used 4 ways |
| 3 | User Control and Freedom | 2 | Stale red "1 error" and amber "31" can't be dismissed |
| 4 | Consistency and Standards | 2 | Header buttons use browser blue focus ring; ⌘B collapses sidebar inside editor |
| 5 | Error Prevention | 3 | Shortcut guard holds (CodeMirror, ⌘C) |
| 6 | Recognition Rather Than Recall | 3 | kbd hints everywhere; Manual tests/Settings/Chats lack keys; ⌘B not in help |
| 7 | Flexibility and Efficiency | 3 | ⌘K T06 Enter opens a chat, not the task |
| 8 | Aesthetic and Minimalist | 3 | Two filled primaries; permanent red/amber |
| 9 | Error Recovery | 1 | "1 error" with no cause or action |
| 10 | Help and Documentation | 2 | Flat 12-row help; Connect lacks claude mcp add snippet |

## Design Specificity
Mostly authored now (status strip, agents-first sidebar, shape-coded markers, ID-first palette); frame still shadcn sidebar-07. Detector CLI 0 findings; browser shell hits mostly false positives. Detector-only: light-theme amber 1.92:1 / danger 2.74:1 (globals.css:23-24 not re-themed); 10px status text. Previous real hits (gradient logo 1.8:1, ⌘K kbd 3.8:1) resolved.

## Priority Issues
- [P1] Status strip blind to terminal MCP agents — AppHeader.tsx:96-103 uses useChats only; use groupSessions(activity).filter(isLive) (src/lib/sessions.ts:75,108); dot-only when connected, "Reconnecting…" when down; Connect menu last-call + claude mcp add snippet. → clarify (A rated P0; downgraded: doesn't block tasks)
- [P1] Permanent alarms — stale interrupted chat as red "1 error" everywhere; amber "31" for advisory manual tests on done tasks (AppSidebar.tsx:64,102-104); light-theme amber/danger inks. → quieter
- [P1] ⌘K exact ID opens chat — rank byId (CommandPalette.tsx:131-137) above chats (:113-122) for /^[TR]\d/i; drop plans/ paths from Docs group (:157-166). → polish
- [P2] Two primaries + "Agents" overloaded — ghost header button; page named "Chats"; roadmap "live" → "active". → distill
- [P2] Keyboard/SR gaps — UA focus rings (AppHeader.tsx:63,76,107,166; ProjectSwitcher.tsx:30); silent route changes, static document.title; ⌘B in editor (ui/sidebar.tsx:105-110); aria-live in button (AppHeader.tsx:143), aria-label on span (AppSidebar.tsx:98), aria-expanded always true (CommandPalette.tsx:207). → harden

## Persona Red Flags
- Alex: ID+Enter wrong target; free keys t/s/g unused; no switcher filter; ⌘B conflict; ungrouped help.
- Sam: ~15 sidebar tab stops before header; silent page changes; live region in button; ARIA misuse; off-system focus ring.
- Solo dev, 3 terminal agents: header says nothing about them; collapsed rail no running spinner; mobile "● ● 1".

## Minor Observations
Empty rootParam malformed URLs (CommandPalette.tsx:96, AppContext.tsx:168) + swallowed refresh errors (AppContext.tsx:81); duplicated running count; 9 unlabelled rail icons (Memory vs Docs); 390px breadcrumb drops page; `c` target unlabeled.

## Questions to Consider
- Should the strip serve terminal MCP agents, in-app chats, or both?
- What would a strip showing only actionable state look like?
- If the loud thing were "the agent that needs you", does the header need an Agents button?
