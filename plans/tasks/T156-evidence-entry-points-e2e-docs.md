# T156: Open evidence from the task panel and card badge, e2e, docs
**Status:** 📋 Todo
**Phase:** R060 — Evidence report per task
**Size:** M (2–3 hrs)
**Depends on:** T155

## Goal
Opening a done task anywhere leads to its evidence in one click: from the task panel, and from the 🧪 badge on the board card.

## Context
- Epic: `plans/roadmap/R060-evidence-report-per-task.md`. "Done when": opening a done task shows its evidence doc with a screenshot and result for every automated checklist item.
- The evidence view is `/manual-tests?task=<id>&view=evidence` (T155).
- The task panel shows runs with `TaskRuns` (`src/components/board/TaskRuns.tsx`, mounted in `TaskDetailPanel.tsx` ~line 186). Its header comment says "Full history is R060".
- The card badge `🧪 done/total` is in `src/components/board/TaskCard.tsx` (~line 111). The card itself is a `role="button"`, so the badge link must stop propagation and stay keyboard reachable.

## Scope
- [ ] Task panel: an "Evidence" link in the `TaskRuns` header (and in the manual-tests section when there are no runs but a checklist exists) → `/manual-tests?task=<id>&view=evidence`. Update the stale "Full history is R060" comment.
- [ ] Card: clicking the 🧪 badge opens the evidence view instead of the panel. Keep the tooltip and add "· click for evidence". Enter on the focused badge does the same.
- [ ] e2e `e2e/evidence.mjs`:
  - Run the capture demo for a temp task in a fixture project.
  - Open its card badge → the evidence view shows each step's screenshot (the images are loaded: `naturalWidth > 0`).
  - Pick an older run in History.
  - Clean up the runs dir in `finally`.
- [ ] Docs:
  - CLAUDE.md `/manual-tests` line plus `tasks/[id]/evidence` in the API list.
  - MEMORY.md conventions: evidence = derived from run.json plus the checklist; the fixture writes `EVIDENCE.md`; core never does.
  - `docs/architecture/mcp-tools.md`, if T154 missed anything.
- [ ] Mark R060 done when the epic's "Done when" holds (check it on T138).

**Out of scope:** Run buttons (R061), the review flow from evidence (R062).

## Files
- `src/components/board/TaskRuns.tsx`, `src/components/board/TaskDetailPanel.tsx`
- `src/components/board/TaskCard.tsx`
- `e2e/evidence.mjs`: new. Follow `e2e/manual-tests-review.mjs` for setup.
- `CLAUDE.md`, `memory/MEMORY.md`

## Implementation notes
- The card is draggable: make sure a badge click doesn't start a drag or open the panel (`e.stopPropagation()` on click and keydown).
- Use `next/link` or `router.push`, as the rest of the board does for `/roadmap?item=`.

## Acceptance criteria
- [ ] Board → click 🧪 on T138's card → `/manual-tests?task=T138&view=evidence` opens with screenshots.
- [ ] Task panel → Evidence → same view.
- [ ] Clicking the card body still opens the panel, and dragging the card between columns still works.
- [ ] `node e2e/evidence.mjs` passes.

## Verify
```bash
pnpm lint && pnpm build
node e2e/evidence.mjs
```
