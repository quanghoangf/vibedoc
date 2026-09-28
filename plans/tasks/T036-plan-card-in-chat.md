# T036: PlanCard in chat — preview, uncheck, Accept/Reject
**Status:** ✅ Done
**Phase:** R040 — Planning from the chat sidebar
**Size:** M (2–3 hrs)
**Depends on:** T035

## Goal
When the agent calls `vibedoc_propose_plan` in the chat sidebar, the user sees every proposed task in a card, can uncheck any of them, and presses Accept to create the checked ones. Nothing is written before Accept. With this task, the thin slice works end to end: chat → preview → files.

## Context
- Epic: `plans/roadmap/R040-planning-from-the-chat-sidebar.md`
- Copy the proposal pattern already in the chat:
  - `ChatPanel.handleEvent()` (`src/components/chat/ChatPanel.tsx` ~line 50) collects `vibedoc_propose_edit` tool_use blocks into `message.proposals`, and drops the ones whose `tool_result` has `is_error`.
  - `ProposalCard` renders one of them.
  - `resolveProposal()` queues a note (`notesRef`) that is sent with the user's next message, so the agent learns the outcome.
- The plan shape and `POST /api/plan/apply { plan, selected }` come from T035 (`src/lib/plan.ts`).
- Decided: the user can uncheck items, then Accept writes the checked ones. Reject sends a note so the agent can revise.
- Tailwind only, existing tokens (`bg-surface2`, `border-border`, `text-accent`, …). No `localStorage`.

## Scope
- [ ] `src/components/chat/PlanCard.tsx` (new). Shows the epic id and title, and one row per task: a checkbox (checked by default), title, size and depends-on. Clicking a row expands the task body, rendered with `MarkdownRenderer`. Buttons: Accept (N) and Reject.
- [ ] `ChatPanel`: collect `vibedoc_propose_plan` tool_uses into a new `message.plans`, the same way as `proposals`, including dropping failed ones. Render `PlanCard`s.
- [ ] Accept: `POST /api/plan/apply${rootParam}`. On success, the card shows "Created T041–T044" with each id linking to its task file (`openDoc(file)`). On a 400, the error is shown inside the card and the card stays pending.
- [ ] Outcome notes for the agent, sent through `notesRef`: `User accepted plan for R0xx: created T041, T042 (unchecked: t3).` or `User rejected the plan for R0xx.`
- [ ] Extract a `stubChat(page, events)` Playwright helper, so later tasks can reuse it for their browser checks

**Out of scope:** the roadmap kind (T039 adds a tree view to this card), questions (T037), editing a task's text inside the card.

## Files
- `src/components/chat/PlanCard.tsx`: new
- `src/components/chat/ChatPanel.tsx`: the `ChatMessage` type, `handleEvent`, rendering
- `e2e/stub-chat.mjs` (or the scratch location the repo uses for Playwright scripts, if one exists): new helper

## Implementation notes
- Match the tool name with `b.name.endsWith("vibedoc_propose_plan")`, like the proposal filter does. Remember to exclude it from the `tools` chip list too.
- A card's state is `pending | accepted | rejected`, plus `created` ids after Accept. Keep it in the message, like `Proposal.status`.
- The browser check doesn't need a live `claude`: intercept `/api/chat` with `page.route()` and fulfil it with NDJSON lines. Minimal events:
  ```
  {"type":"assistant","session_id":"s1","message":{"content":[{"type":"tool_use","id":"tu1","name":"mcp__vibedoc__vibedoc_propose_plan","input":{"plan":{…}}}]}}
  {"type":"result","is_error":false,"session_id":"s1"}
  ```
  `/api/plan/apply` stays real, pointed at a fixture root. The UI takes its root from `/api/projects`, so stub that to return the fixture (T032 had to do the same).

## Acceptance criteria
- [ ] A stubbed `propose_plan` with 3 tasks renders a card with 3 checked rows. No files exist yet.
- [ ] Unchecking t3 and clicking Accept creates 2 task files. The card shows their ids, and they appear on the board without a reload.
- [ ] Unchecking t1 while t2 depends on it shows the dependency error inside the card, and nothing is written
- [ ] Reject marks the card rejected, and the next message sent includes the reject note
- [ ] Lint: no new errors (baseline 16)

## Verify
```bash
pnpm build && pnpm lint
node e2e/stub-chat.mjs   # or the Playwright script you wrote: stubbed chat → Accept → ls <fixture>/plans/tasks
```
