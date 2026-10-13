# T526: vibedoc_propose_toolkit + ToolkitCard: the agent asks, the user confirms
**Status:** 👀 Review
**Phase:** R098 — Agent toolkit setup
**Size:** M
**Depends on:** T525
**Covers:** S5
**Owner:** ai:claude-code
**Due:** 2026-10-16
**Started:** 2026-10-13

## Goal
A user can say "set up my toolkit" to the in-app agent. The agent shows a card in chat with the same ranked checkboxes, and the user confirms the same dialog. The installs and the ✓/errors come from VibeDoc, not from the agent's shell.

## Context
- Epic: `plans/roadmap/R098-agent-toolkit-setup.md`. The spec "Confirmed install" applies to the chat as well ("whether the request came from the welcome or the in-app agent").
- Decision: a propose tool plus a card, following `vibedoc_propose_plan` → PlanCard (T039/T040) and `vibedoc_ask_questions` → QuestionCard (T041). The agent never runs install commands itself.
- Tool: `vibedoc_propose_toolkit { preselect?: string[], note?: string }`. It returns the ranked list as text (id, reason, installed) plus "shown to the user; end your turn". Unknown ids in `preselect` are refused with the valid ids. The outcome (installed / failed per id) arrives as the next user message, like ask_questions answers.
- The card reuses `ToolkitPicker` + `ToolkitConfirmDialog` from T2 and the same `POST /api/toolkit`.
- The chat preamble or planning guide: one line telling the agent to use `vibedoc_propose_toolkit` when the user asks for plugins/skills/toolkit setup.

## Scope
- [ ] MCP tool `vibedoc_propose_toolkit`, registered next to `vibedoc_propose_plan`
- [ ] `ToolkitCard` in the chat message renderer (same place PlanCard renders), with a result summary posted back as the next user message
- [ ] Chat preamble line
- [ ] i18n en + vi for card strings
- [ ] docs/mcp-tools.md entry
- [ ] e2e: call the tool via the MCP endpoint, the card appears, confirm installs via the stub, and the results message lands in chat

**Out of scope:** the agent recommending plugins outside the catalog, installs via the agent's own shell.

## Files
- The MCP tools module where `vibedoc_propose_plan` is registered; the chat card renderer where `PlanCard` is used
- `src/components/chat/ToolkitCard.tsx`: new
- `docs/mcp-tools.md`, `e2e/toolkit.mjs` (extend)

## Acceptance criteria
- [ ] S5: the agent calls the tool → the chat shows the ranked list with reasons; ticking + Install opens the same dialog; Confirm installs only the ticked items with per-item ✓/error
- [ ] Closing the dialog without confirming installs nothing
- [ ] `preselect` with an unknown id → a tool error listing the valid ids
- [ ] docs/mcp-tools.md documents the tool; `vibedoc_check_docs` is clean for it

## Verify
```bash
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH PORT=3081 pnpm dev:next &
BASE=http://localhost:3081 node e2e/toolkit.mjs
```

## Manual tests
_2026-10-13 — ai · Spec: `e2e/vibedoc/T526-vibedoc-propose-toolkit-toolkitcard-the-.spec.ts` · Auto: passed 2026-10-13_
### Steps
- [x] 🤖 Ask the agent to set up the toolkit → a "Pick plugins to install" card shows its note and the ranked plugins
- [x] 🤖 The plugin the agent preselected (TypeScript LSP) is ticked
- [x] 🤖 Click Install selected, then press Escape → only the confirm dialog closes; the chat and its card stay
- [ ] In a real chat, type "set up my toolkit" → the agent calls vibedoc_propose_toolkit and the card appears (no install commands in its reply)
- [ ] Tick a plugin, Install selected → Install → it turns "Installed" in the card, and the agent's next reply reacts to "Toolkit install results:"
- [ ] Reload the page → the card shows "Installed: …" / "Failed: …" instead of the checkboxes
### Regression risk
- [ ] A planning chat still shows question cards and the plan card, and answering a question still sends the answers
- [ ] The welcome step "Pick your toolkit" still installs (it now shares the same hook)
