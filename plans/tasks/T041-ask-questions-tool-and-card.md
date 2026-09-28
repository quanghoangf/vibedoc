# T041: vibedoc_ask_questions + QuestionCard
**Status:** ✅ Done
**Phase:** R040 — Planning from the chat sidebar
**Size:** M (2–3 hrs)
**Depends on:** T040

## Goal
In chat, the agent can ask the same checkbox questions the planning skills ask in the terminal. The user answers by clicking options in a card, and the answers go back to the agent as the next message. This is what makes the planning interview possible without a terminal, because `AskUserQuestion` doesn't exist under `claude -p`.

## Context
- Epic: `plans/roadmap/R040-planning-from-the-chat-sidebar.md`
- The chat spawns one `claude -p` per turn and continues with `--resume <sessionId>` (`src/app/api/chat/route.ts`). A tool can't wait for the user mid-turn. So the tool only records the questions, the agent ends its turn, and the answers arrive as the next user message.
- Mirror `AskUserQuestion`'s shape, because the SKILL.md files are written for it. That way the chat preamble in T042 only has to say "use vibedoc_ask_questions instead", not re-explain the format.
- The card and message plumbing follows T040's `PlanCard` (a tool_use is collected into the message, then rendered).

## Scope
- [ ] MCP `vibedoc_ask_questions`: input `{ questions: [{ question, header, multiSelect, options: [{ label, description? }] }] }`, with 1–4 questions and 2–4 options each. Validate the shape and throw on violations. Return: `❓ Shown N question(s) to the user. End your turn now; their answers arrive in the next message.`
- [ ] `src/components/chat/QuestionCard.tsx` (new): per question, show the header chip, the question, and options as checkboxes (`multiSelect`) or radios, each with its description. Add an "Other" option with a text input. One Submit button for the whole card.
- [ ] Submit sends a normal chat message built from the answers (format below), then locks the card and shows the chosen answers
- [ ] While a question card is pending, the textarea placeholder says "Answer the questions above…". Typing a free-text message still works; it's the user's escape hatch.

**Out of scope:** the planning prompt (T042), timeouts, changing answers after submit.

## Files
- `src/app/api/mcp/route.ts`: tool definition and `case`
- `src/components/chat/QuestionCard.tsx`: new
- `src/components/chat/ChatPanel.tsx`: collect `questions`, render them, submit through the existing `send()` path

## Implementation notes
- Refactor `send()` so it can take a message argument instead of only reading `input`, and reuse it for Submit. Don't duplicate the fetch and stream loop.
- Answer message format, so the agent can parse it reliably:
  ```
  Answers:
  - Users: Solo devs + Claude Code, Small teams sharing a repo
  - Budget: ~1 week (5–8 tasks)
  - Scope: Other: "only the billing page"
  ```
  Key each line by the question's `header`. Keep the label text exactly as offered.
- Strip a trailing " (Recommended)" when showing the chosen answers? No: keep the labels verbatim in the message, so the agent can match them against its own options.

## Acceptance criteria
- [ ] A stubbed `ask_questions` with one multi-select and one single-select question renders checkboxes and radios, and "Other" accepts text
- [ ] Submit sends exactly one chat message in the format above (check the intercepted `/api/chat` request body), and the card becomes read-only
- [ ] An invalid tool input (5 questions, or 1 option) returns `isError` with the reason
- [ ] Lint: no new errors (baseline 16)

## Verify
```bash
pnpm build && pnpm lint
# Playwright with the stubChat helper from T040: render the card → pick answers → Submit → assert the request body
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_ask_questions","arguments":{"questions":[{"question":"Q?","header":"H","multiSelect":false,"options":[{"label":"only one"}]}]}}}'; echo   # → isError
```
