# T292: Memory, activity and chat empty states
**Status:** 📋 Todo
**Phase:** R083 — Teaching empty states
**Size:** M (2–3 hrs)
**Depends on:** T290
**Covers:** S1, S2, S4

## Goal
Memory, Activity and Chat in an empty project explain what the agent puts there and give one action.

## Context
- Epic: `plans/roadmap/R083-teaching-empty-states.md`
- Reuse T290's `EmptyState`, `CopyCommand`, `useAgentConnected`.
- Memory: entries list (`EntryList.tsx:81`, "No knowledge entries yet. Agents save them with `vibedoc_save_entry`", "+ New entry" in the header), handoff (`MemoryTab.tsx:162`, "No MEMORY.md yet" + a static CLAUDE.md `<pre>` snippet), graph (`MemoryGraph.tsx:129`).
- Activity (`ActivityTab.tsx:151`): text points at the header Connect menu, no action.
- Chat (`chat/page.tsx:164` `NoChat`): has a line and three suggestion buttons; the sidebar list says "No chats yet."

## Scope
- [ ] Memory handoff pane: lead = the agent writes a handoff here at the end of each session so the next one picks up; action = copy the CLAUDE.md snippet (CopyCommand or a copy button on the existing `<pre>`); needsAgent.
- [ ] Memory entries list: lead = facts that outlast a session (conventions, gotchas, decisions); action = "+ New entry" (moved into the empty state, or marked as its action).
- [ ] Memory graph: lead on what links entries; action = link back to the entries list.
- [ ] Activity: lead = board moves and every agent call show here live; action = when no agent, "Connect your agent" link (`CONNECT_HREF`) as the primary action; when connected but empty, link to /board.
- [ ] Chat: keep `NoChat`; make one suggestion primary (`data-empty-action`, "Plan a roadmap…" when there's no roadmap is fine to keep simple: first suggestion), others secondary; the sidebar "No chats yet." stays. Chat runs `claude -p` locally, so it doesn't need MCP connected: no connect line.
- [ ] i18n `memory.ts`, `chat.ts`, `en` + `vi`.
- [ ] Extend `e2e/empty-states.mjs` with /memory, /memory?view=graph, /activity, /chat.

**Out of scope:** first-week checklist (R084).

## Files
- `src/components/memory/{MemoryTab,EntryList,MemoryGraph}.tsx`, `src/components/activity/ActivityTab.tsx`, `src/app/(app)/chat/page.tsx`
- `src/i18n/memory.ts`, `src/i18n/chat.ts`
- `e2e/empty-states.mjs`

## Acceptance criteria
- [ ] Each page above, empty project: a `[data-empty-state]` with a lead and one `[data-empty-action]` (memory: the handoff pane and the entries list may each have one; count per state)
- [ ] Activity with no agent → primary action is the Connect link; after an MCP call the activity has rows, so the empty state is gone
- [ ] vi passes the i18n checks

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3083 PW_DIR=. node e2e/empty-states.mjs
BASE=http://localhost:3083 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
### Steps
- [ ] S1 — WHEN the user opens /memory, /activity, /chat in an empty project → THEN each says what fills it and offers one action
- [ ] S2 — WHEN no agent is connected → THEN Activity and the memory handoff link to Connect
- [ ] S4 — WHEN the language is Tiếng Việt → THEN these empty states are Vietnamese
