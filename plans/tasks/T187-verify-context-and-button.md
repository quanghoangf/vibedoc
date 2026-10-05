# T187: vibedoc_verify_context and the "Verify" button
**Status:** 👀 Review
**Phase:** R067 — Spec verification review
**Size:** M (2–3 hrs)
**Depends on:** T186
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
One click on a finished task starts an agent that has everything needed to judge it: what was asked, what the capability must keep doing, the project's conventions, and the change itself.

## Context
- Epic: `plans/roadmap/R067-spec-verification-review.md`.
- Decision: the review runs in the agent chat. The UI only calls `askAgent()` (`src/lib/ask-agent.ts`), as the "Break down" buttons do in `RoadmapItemSheet.tsx`; no headless spawn.
- The task's change = commits whose message contains the task id (this repo's convention: `feat(x): … (T156)`). `getFileHistory()` in core already shells out to git with `execFile`; follow it.

## Scope
- [ ] core `getVerifyContext(taskId, root)` and MCP `vibedoc_verify_context { taskId }` returning:
  - the task's Goal, Scope, Acceptance criteria, Out of scope
  - the epic's "Done when"
  - `## Related spec` if R066's `relatedSpecs()` exists (skip silently otherwise)
  - knowledge entries of type `convention` that rank for the task (`rankEntries`)
  - commits matching the id (`git log --grep=<id> --format=%H %s`) and their combined diff, capped (~2,000 lines; say what was cut), plus the head sha for `vibedoc_report_findings`
  - instructions: check each criterion, report only real gaps with a file:line, severity rules (critical = a criterion not met, major = wrong behaviour/edge case, minor = polish), report even when nothing is found.
- [ ] No commits found → say so and ask the agent to compare against the working tree diff instead.
- [ ] "Verify" button in the task panel (status review or done) and on cards in the Review column → `askAgent("Verify task T… : call vibedoc_verify_context, then vibedoc_report_findings.", { newChat: true })`.
- [ ] Doc: `docs/architecture/mcp-tools.md`.

**Out of scope:** send back (T188), automatic runs.

## Files
- `src/lib/core.ts`, `src/app/api/mcp/route.ts`
- `src/components/board/TaskDetailPanel.tsx`, the Review column card action

## Acceptance criteria
- [ ] On this repo, `vibedoc_verify_context { taskId: "T156" }` lists T156's acceptance criteria and the diff of its commit(s).
- [ ] Clicking Verify on a review task opens a chat that ends with a `## Verification` section on that task.
- [ ] A task with no matching commits gets the working-tree fallback message.

## Verify
```bash
pnpm lint && pnpm build
curl -s localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_verify_context","arguments":{"taskId":"T156"}}}' | head -c 2000
```

## Manual tests
_2026-10-05 — ai · Spec: `e2e/vibedoc/T187-verify-context-and-button.spec.ts` · Auto: passed 2026-10-05_
### Steps
- [x] 🤖 Open a task in review → the panel shows a Verify button next to Chat about task
- [x] 🤖 Click Verify → a new agent chat starts with "Verify task <id>: call vibedoc_verify_context, then vibedoc_report_findings."
- [x] 🤖 Close the panel and hover the task's card in Review → a Verify button shows on the card
- [ ] Click Verify on a real review task (e.g. T186) with the agent running → the chat calls vibedoc_verify_context then vibedoc_report_findings, and the task panel gains a Verification block
- [ ] vibedoc_verify_context { taskId: "T156" } → lists T156's acceptance criteria and the diff of its commit; for a task with no commits (e.g. T188) it says to compare against the working tree
### Regression risk
- [ ] Chat about task / Open chat on the panel still opens that task's chat, and the card's ⋯ menu and Run button still work
