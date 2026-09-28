# T053: "Break down" on a doc page: the doc is the spec
**Status:** 📋 Todo
**Phase:** R033 — AI-generated task breakdowns
**Size:** S (~1 hr)
**Depends on:** T051

## Goal
Specs often already live in `docs/` (PRDs, brainstorm notes). The user breaks one down from the doc page, and the resulting epic and tasks link back to the doc.

## Context
- Epic: `plans/roadmap/R033-ai-generated-task-breakdowns.md`
- Use `askAgent()` from `src/lib/ask-agent.ts`, like the roadmap buttons do.
- The chat agent can read docs with the VibeDoc MCP doc tools, so pass the path, not the content.

## Scope
- [ ] Add a "Break down with agent" action to the doc view header or toolbar (`DocViewer.tsx` / `EditorToolbar.tsx`, wherever the doc-level actions live). It is shown for `.md` docs.
- [ ] It calls `` askAgent(`Break down the spec in ${path} into tasks.`) ``.
- [ ] In `skills/epic-breakdown/SKILL.md` "From a spec" (T051): when the spec is a doc path, read it with the doc tool. Put `` Spec: `<path>` `` in the new epic body and in each task's `## Context`.

**Out of scope:** automatic backlinks from the doc to the tasks (the backlinks panel already picks up mentions if it scans plans).

## Files
- `src/components/docs/DocViewer.tsx` or `src/components/docs/EditorToolbar.tsx`: the action
- `skills/epic-breakdown/SKILL.md`: the doc-as-spec note

## Acceptance criteria
- [ ] On a doc page, "Break down with agent" opens the chat, and the agent reads that doc and runs the T051 flow.
- [ ] The accepted epic and tasks contain `` Spec: `docs/...` ``.
- [ ] No new react-hooks lint errors.

## Verify
```bash
pnpm build && pnpm lint
# UI: open a docs/*.md spec → Break down with agent → Accept → grep -l 'Spec: `docs/' plans/tasks plans/roadmap
```
