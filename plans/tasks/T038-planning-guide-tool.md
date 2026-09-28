# T038: vibedoc_get_planning_guide — SKILL.md + chat preamble
**Status:** ✅ Done
**Phase:** R040 — Planning from the chat sidebar
**Size:** S (~1 hr)
**Depends on:** T037

## Goal
When a user types "plan a roadmap" or "break down R040" in chat, the agent loads the same instructions the terminal skills use, adapted to chat, and runs the interview through `vibedoc_ask_questions` and `vibedoc_propose_plan`. The planning logic has one source of truth: `skills/*/SKILL.md`.

## Context
- Epic: `plans/roadmap/R040-planning-from-the-chat-sidebar.md`
- Decided: the agent loads the instructions lazily through an MCP tool, instead of getting them in the system prompt. A resumed session keeps its first system prompt (see the comment in `src/app/api/chat/route.ts`), and the skills are ~120–160 lines each.
- Next runs with `cwd` set to the VibeDoc package root (`bin/vibedoc.mjs` spawns `next start` with `cwd: projectRoot`), so `path.join(process.cwd(), 'skills', …)` finds the bundled skills in dev and when installed. The target project's root is a different directory, `VIBEDOC_ROOT`.
- Only `src/lib/core.ts` touches the file system.

## Scope
- [ ] `core.ts`: `readPlanningSkill(kind: 'roadmap' | 'breakdown')` reads `skills/roadmap-planner/SKILL.md` or `skills/epic-breakdown/SKILL.md` from `process.cwd()` and strips the YAML frontmatter
- [ ] MCP `vibedoc_get_planning_guide { kind }` returns the chat preamble (below) followed by the skill text
- [ ] `/api/chat` SYSTEM_PROMPT: add one sentence. "For requests to plan a roadmap or break an epic into tasks, first call vibedoc_get_planning_guide and follow it."
- [ ] `package.json` `files`: add `"skills/"` so the npm package ships them

**Out of scope:** the roadmap kind of `propose_plan` (T039). Until T039 lands, the roadmap guide still loads, but proposing a roadmap plan fails validation.

## Files
- `src/lib/core.ts`: `readPlanningSkill()`
- `src/app/api/mcp/route.ts`: tool definition and `case`
- `src/app/api/chat/route.ts`: `SYSTEM_PROMPT`
- `package.json`: `files`

## Implementation notes
Chat preamble. Keep it short; it only maps the skill's terminal tools to chat tools:

```
You are running this planning skill inside the VibeDoc chat, not a terminal:
- Where it says AskUserQuestion, call vibedoc_ask_questions with the same shape, then END YOUR TURN; answers arrive as the next message ("Answers: - <header>: <labels>").
- Where it says to show the draft and ask Create/Adjust, call vibedoc_propose_plan instead; the user previews, unchecks and accepts in the UI. Never write files yourself.
- Read the project with vibedoc_* tools (vibedoc_get_roadmap, vibedoc_list_tasks, vibedoc_read_doc, vibedoc_search_docs, vibedoc_get_file_map); you have no shell or file access.
- Skip steps that need a shell or the codebase beyond what those tools return; say so briefly.
```

- The breakdown skill tells the agent to read code. The chat agent can only reach docs and tasks through the MCP tools. Task quality will be lower than in the terminal, and the preamble says so honestly rather than pretending otherwise.

## Acceptance criteria
- [ ] `vibedoc_get_planning_guide { kind: "breakdown" }` returns the preamble plus the epic-breakdown skill body, without frontmatter
- [ ] It works when `VIBEDOC_ROOT` points to a different project (the skills are read from the package, not the target)
- [ ] An unknown `kind` returns `isError`
- [ ] `npm pack --dry-run` lists `skills/roadmap-planner/SKILL.md` and `skills/epic-breakdown/SKILL.md`

## Verify
```bash
pnpm build && pnpm lint
curl -s "localhost:3000/api/mcp?root=$(mktemp -d)" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_planning_guide","arguments":{"kind":"breakdown"}}}' | head -c 600; echo
npm pack --dry-run 2>&1 | grep skills/
```
