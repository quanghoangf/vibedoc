# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A solo developer on their own machine who uses one or more AI coding agents (Claude Code, Cursor) on one repo at a time. VibeDoc stays open in a browser tab next to the editor and terminal while the agents work.

## Product Purpose
VibeDoc is local-first project intelligence for AI-assisted development: a kanban board, docs viewer, roadmap and agent chat in the browser, and an MCP server for the agent, all in one process. It exists because AI sessions lose context between chats. VibeDoc gives the agent a persistent home (tasks, ADRs, memory handoff), so the next session picks up where the last one stopped.

Planning and supervising count equally. One loop covers both: plan (roadmap → epics → tasks), hand off to the agent, watch tasks move live, answer chats that need you, then review finished work. Success means the developer always knows what the agents are doing and what needs them next, without leaving their repo's files.

## Positioning
The UI and the AI agent read and write the same markdown files through the same API layer, in one local process. The human's board is literally the agent's to-do list, and every agent action shows up in the browser in real time over SSE.

## Operating Context
- Started with `npx vibedoc` inside a project; it picks a free port and opens the browser. `VIBEDOC_ROOT` points it at another project.
- The agent connects over HTTP JSON-RPC MCP at `/api/mcp` (46 tools).
- Source files in the target repo: `plans/tasks/T*.md`, `plans/roadmap/R*.md` + `layout.json`, `docs/**/*.md`, `docs/architecture/decisions/ADR-*.md`, `memory/MEMORY.md`, `.vibedoc-activity.json`, `.vibedoc/chats/*.json`.
- Surfaces: board, docs (editor with live collaborative buffer), roadmap (map + timeline), agent chats (modal + `/chat`), manual tests, activity, memory, file explorer, command palette.
- In-app agent chats run `claude -p` against the local Claude Code login, with VibeDoc MCP tools only. Up to 4 run in parallel.

## Capabilities and Constraints
- **Files are the truth.** All state lives in plain markdown/JSON in the target repo. There is no database, and the UI never holds state the agent can't read.
- **Local-first, no account.** Zero config, no login, no cloud service.
- **Keyboard-first.** A command palette and single-key shortcuts (e.g. `c` opens a chat) are primary paths for power users, not extras.
- Agent edits are proposals (diff, then Accept/Reject). Plans write nothing until accepted.
- Review and manual tests are advisory. Nothing blocks moving a task to done (ADR-005).
- Stack: Next.js 16 App Router, Tailwind CSS 4, no CSS-in-JS, no `localStorage`.
- Terminology: horizon → epic (roadmap `R*`) → task (`T*`); statuses todo / in-progress / review / done / blocked; "needs you" = a chat waiting on the user.

## Brand Commitments
- Name: **VibeDoc**. Tagline: "Local-first project intelligence for AI-assisted development."
- Open source (MIT), published to npm as `vibedoc`.

## Evidence on Hand
- README screenshot: `image.png`.
- No testimonials, user counts, benchmarks or case studies exist. Do not fabricate any.

## Product Principles
1. **The repo is the record.** Anything the UI shows or changes must round-trip through readable files that an agent or a human in an editor can see.
2. **Supervision at a glance.** What's running, what's waiting on me and what just changed should be visible without digging.
3. **Plan and supervise are one loop.** Moving between the roadmap, the board, chat and review should feel like one continuous flow, not separate apps.
4. **Hands stay on the keyboard.** Every frequent action has a keyboard path.
5. **Zero ceremony.** `npx vibedoc` and it works. No accounts, setup walls or config.
