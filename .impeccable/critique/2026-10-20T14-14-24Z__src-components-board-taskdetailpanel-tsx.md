---
target: task panel Work with agent → chat
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/hoangquangnguyen/work/vibedoc/src/components/board/TaskDetailPanel.tsx"
target_fingerprint: "sha256:e14232b4b8c1b4d8e84823d2ca4d96a946089e170e7a9d994e30c2da313daadd"
target_path: /Users/hoangquangnguyen/work/vibedoc/src/components/board/TaskDetailPanel.tsx
timestamp: 2026-10-20T14-14-24Z
slug: src-components-board-taskdetailpanel-tsx
---
# Critique: task panel → Work with agent → run card → worker chat
Method: dual-agent (A: design review · B: detector/browser)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | POST /api/workers awaits createWorktree + installWorktreeDeps; dialog locked on "Starting…" |
| 2 | Match real world | 2 | Base shows HEAD; refusal text is agent-facing English, not i18n |
| 3 | User control | 2 | Can't close while starting; focus drops to body after Esc |
| 4 | Consistency | 2 | Epic sheet = button, task panel = 4th ⋯ item, no ⇧ key |
| 5 | Error prevention | 2 | canRun allows in-progress/review then server refuses; unmet deps not flagged |
| 6 | Recognition | 2 | chatFor excludes workers: task panel never points to its running worker |
| 7 | Efficiency | 1 | No shortcut, not in ⌘K, 4 pointer steps, 69 Tabs to ⋯ |
| 8 | Minimalist | 3 | 14 tool chips dominate; cost/where-it-runs weakest |
| 9 | Error recovery | 2 | "stop it from its chat" / "Settings → Workers" are text, not links |
| 10 | Help | 3 | notSandbox caveat only in Settings |
| **Total** | | **21/40** | Acceptable |

## Priority issues
- [P0] Accept blocks on dependency install inside a locked dialog (api/workers/route.ts:73-95, RunCard.tsx:84). Fix: return id after saveWorkerChat, install in background, close dialog, show(id) → strip shows phaseStarting.
- [P1] The action is hidden: ⋯ item (TaskDetailPanel.tsx:207), no key/⌘K; primary button is "Chat about task", "start" only moves status. Fix: visible primary "Work with agent" in quick actions for runnable tasks, ITEM_KEYS ⇧W in useItemCommands.
- [P1] After Accept you land in a modal, not /chat, and the task never links back to its worker. Fix: navigate to /chat?id=<worker>; panel shows "Open worker · running · 12 turns" when a worker holds the task/epic; busy/limit messages become links.
- [P2] canRun ≠ server rule (TaskDetailPanel.tsx:146 vs run-proposal.ts:111); unmet deps silent. Fix: same rule; warn line for unfinished deps.
- [P2] Card hierarchy: HEAD base, 14 chips expanded, no sandbox caveat, focus on X. Fix: resolved base branch, collapse tools "14 allowed · 2 denied ▸", notSandbox line, autofocus Start.

## Persona red flags
- Alex: 4 clicks, no key, Enter on X closes the dialog.
- Sam: focus lost on Esc; tool list has no list semantics; disabled Start looks green-dimmed.
- Solo dev with 2 workers: limit refusal only after card loads; no "2/2 workers" at board level; Chat about task opens a second chat beside the worker.

## Minor
- Loading flash of empty form; phone chips push Start below fold; worker title "Worker T199" hardcoded English; raw server errors pre-wrap.
- Detector: CLI 0 findings on target files; browser findings all outside the run card (shell, board cards, chat transcript 10px ids, 1.8:1 gradient avatar tile on /chat). Teal done icon, header/sidebar nested-cards, Geist overuse = false positives.

## Questions
- Should a runnable todo task lead with the run instead of Chat about task?
- Does a returning user need all 14 chips, or "same as last run ✓"?
- Should a worker become the task's one chat?
