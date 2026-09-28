# T052: "Plan from spec" button and paste dialog on /roadmap
**Status:** 📋 Todo
**Phase:** R033 — AI-generated task breakdowns
**Size:** S (~1 hr)
**Depends on:** T051

## Goal
A user can find the spec flow without knowing what to type in the chat: they click a button, paste a spec, and the agent starts the breakdown.

## Context
- Epic: `plans/roadmap/R033-ai-generated-task-breakdowns.md`
- `askAgent(message)` from `src/lib/ask-agent.ts` opens the chat sidebar and sends the message. "Plan with agent" (`RoadmapTab.tsx` ~line 335) and "Break down with agent" (`RoadmapItemSheet.tsx` ~line 199) already use it.
- Use the shadcn `ui/` components (Dialog, Textarea, Button). Tailwind only. No localStorage.

## Scope
- [ ] Add a "Plan from spec" button next to "Plan with agent" in `RoadmapTab.tsx`. It shows whether or not the roadmap is empty.
- [ ] The button opens a dialog with a textarea ("Paste a feature spec…") and a "Break down" button that stays disabled while the text is blank.
- [ ] Submit closes the dialog and calls `` askAgent(`Break down this spec into tasks:\n\n${spec}`) ``.

**Out of scope:** the doc-page entry point (T053) and file upload.

## Files
- `src/components/roadmap/RoadmapTab.tsx`: button and dialog (extract it into `PlanFromSpecDialog.tsx` in the same folder if the tab gets long)

## Acceptance criteria
- [ ] Button → dialog → paste → Break down: the chat opens with the spec message and the agent starts the T051 flow.
- [ ] While a chat turn is running, askAgent's existing "refuse while a turn runs" behavior applies. Check that the user sees the refusal instead of losing the spec silently.
- [ ] No new react-hooks lint errors.

## Verify
```bash
pnpm build && pnpm lint
# UI: /roadmap → Plan from spec → paste → the chat opens and the agent asks new epic / existing / loose
```
