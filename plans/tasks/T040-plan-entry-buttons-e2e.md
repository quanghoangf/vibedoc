# T040: "Plan with agent" / "Break down" buttons + live end-to-end run
**Status:** ✅ Done
**Phase:** R040 — Planning from the chat sidebar
**Size:** S (~1 hr)
**Depends on:** T038, T039

## Goal
From the roadmap, one click opens the chat with the right request already sent: "Plan with agent" on an empty roadmap, and "Break down with agent" in the sheet of an epic that has no tasks. Then prove the epic's "Done when" with a real, unstubbed run: from an empty roadmap to broken-down epics, without a terminal.

## Context
- Epic: `plans/roadmap/R040-planning-from-the-chat-sidebar.md`
- The chat's open state lives in `src/app/(app)/layout.tsx` (`chatOpen`, ~line 49). `ChatPanel` is rendered there, and the roadmap components are deep below it.
- Decided: use a window `CustomEvent`, so there's no new context. `layout.tsx` listens and opens the chat; `ChatPanel` listens and sends the message through its `send(message)` (refactored in T037).
- Empty-roadmap state: `RoadmapTab.tsx` ~line 327 (the "Generate roadmap" and "Create first horizon" buttons). Epic sheet: `RoadmapItemSheet.tsx` (`ItemForm` buttons, and `LinkedTasks` for epics with tasks).

## Scope
- [ ] `src/lib/ask-agent.ts` (new, tiny): `askAgent(message: string)` dispatches `new CustomEvent("vibedoc:ask-agent", { detail: { message } })`
- [ ] `layout.tsx`: on the event, open the chat. `ChatPanel`: on the event, send `detail.message`. If a turn is already running, ignore the event and show "Agent is busy" rather than queueing.
- [ ] Empty roadmap: a "Plan with agent" button next to "Generate roadmap". It sends "Plan a roadmap for this project."
- [ ] Epic sheet: a "Break down with agent" button when the item is an epic (it has a parent) with no linked tasks. It sends "Break down epic R0xx into tasks."
- [ ] Live run on a fixture project with a few docs and no roadmap. Record the result in this task's notes (see Verify).

**Out of scope:** running `/work-epic` from the UI, and progress indicators beyond the existing "Thinking…".

## Files
- `src/lib/ask-agent.ts`: new
- `src/app/(app)/layout.tsx`: the listener that opens the chat
- `src/components/chat/ChatPanel.tsx`: the listener that sends
- `src/components/roadmap/RoadmapTab.tsx`: the empty-state button
- `src/components/roadmap/RoadmapItemSheet.tsx`: the epic button

## Implementation notes
- Register the listeners in `useEffect` with cleanup. Watch the React Compiler lint rules (the baseline is 16 errors; add none).
- The live run needs `claude` on PATH and logged in, and uses real tokens. Use a small fixture: a README describing a toy product, plus `docs/` with 2 short files. Keep it quick.

## Acceptance criteria
- [ ] On an empty roadmap, "Plan with agent" opens the chat and sends the message; the agent calls `vibedoc_get_planning_guide`, then asks questions through a QuestionCard
- [ ] In an epic with no tasks, "Break down with agent" does the same for that epic id
- [ ] **Epic Done-when, live:** starting from an empty roadmap, answering the questions and accepting the plans produces horizons, epics, and tasks for at least one epic, with no terminal. Record the ids created and anything that went wrong at the end of this file under `## Live run notes`.
- [ ] Lint: no new errors (baseline 16)

## Verify
```bash
pnpm build && pnpm lint
# Playwright (stubbed chat): click each button → assert the intercepted /api/chat body carries the expected message
# Live: VIBEDOC_ROOT=<fixture> pnpm dev → /roadmap → Plan with agent → answer → Accept → Break down with agent → Accept
ls <fixture>/plans/roadmap <fixture>/plans/tasks
```

## Live run notes
Run on 2026-09-28 against the dev server with Playwright + system Chrome. Only `/api/projects` was stubbed (to target the fixture); `/api/chat` spawned the real `claude` CLI and `/api/plan/apply` wrote the files. The fixture was a mktemp project with a toy README ("Pantry") and `docs/overview.md` and `docs/users.md`. The driver picked the "(Recommended)" option (or the first option) for each question and accepted each plan. The stubbed check is `e2e/plan-buttons.mjs`.

**Passing run (4th):** `/roadmap` → Plan with agent → `get_planning_guide` → 2 QuestionCards → roadmap PlanCard (3 horizons, 4 epics) → Accept → **R001 Now, R002 Next, R003 Later, R004 Quick add items, R005 Expiry-sorted pantry list, R006 Used/tossed tracking, R007 Use-it-up recipes**. Then New chat → R004 sheet → Break down with agent → `get_planning_guide` → 1 QuestionCard → breakdown PlanCard → Accept (4) → **T001–T004**, with `R004 **Tasks:** T001, T002, T003, T004`. There was no terminal and no typed message. Time: about 90 s.

**What went wrong first (runs 1–3):**
- Runs 1–2: the agent never proposed a roadmap plan. It asked its own "Create it?" question and wrote the items directly with `vibedoc_create_roadmap_item`, which the roadmap-planner skill names in step 102. So there was no preview. Tightening `PLANNING_PREAMBLE` did not change this. (In those runs, the tasks came from a breakdown the agent offered after the driver's fallback "go with your recommendations" message.)
- Fix 1: `/api/chat` now adds `vibedoc_create_roadmap_item` to `--disallowedTools`, like the doc write tools.
- Run 3: `vibedoc_propose_plan` still threw "roadmap plans are not supported yet". T036's guard in `/api/mcp` was never removed when T039 added the roadmap kind, and the tool schema listed only `kind: "breakdown"`. The agent fell back to proposing raw `plans/roadmap/*.md` edits and gave up.
- Fix 2: removed the guard, and extended the `vibedoc_propose_plan` description and schema with `kind: "roadmap"` (`horizons`, `epics`).
