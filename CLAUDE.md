# VibeDoc — Agent Instructions

## What this is
A Next.js 16 app that serves as both a **kanban/docs viewer** for developers AND an **MCP server** for AI coding agents. One running process, two clients. The UI and the AI agent share the same API layer.

## Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS 4 (CSS-first config in `globals.css`) — dark theme, no component library
- **Runtime:** Node.js 18+ (server-side file system access)
- **MCP transport:** HTTP JSON-RPC 2.0 at `/api/mcp`
- **Real-time:** Server-Sent Events at `/api/events`
- **Data:** File system only — no database. Reads `.md` files from target project.

## Repo structure
```
src/
  app/
    page.tsx              ← Main UI shell (single-page, client component)
    layout.tsx            ← Root layout
    globals.css           ← Tailwind + markdown prose styles
    (app)/roadmap/page.tsx ← Roadmap page (roadmap.sh-style, React Flow)
    (app)/graph/page.tsx  ← Whole-repo doc link graph (React Flow, force layout)
    (app)/chat/page.tsx   ← All agent chats: list · conversation · epic/task context
    (app)/manual-tests/page.tsx ← Tasks with unticked manual test items; tick to save
    api/
      mcp/route.ts        ← MCP JSON-RPC endpoint (AI connects here)
      events/route.ts     ← SSE stream (real-time browser updates)
      tasks/route.ts      ← Task CRUD
      docs/route.ts       ← Doc list/read/search
      memory/route.ts     ← MEMORY.md read/write
      decisions/route.ts  ← ADR creation
      activity/route.ts   ← Activity log read
      projects/route.ts   ← Multi-project discovery
      summary/route.ts    ← Combined project status
      chat/route.ts       ← Agent chat turn: spawns `claude -p` (local login), VibeDoc MCP tools only
      conversations/route.ts ← Saved agent chats (.vibedoc/chats/<id>.json)
      tasks/manual-tests/route.ts ← Tick a task's manual test item
      tasks/review/route.ts ← Approve / send back a task in review
      roadmap/*           ← Roadmap list + create/update/delete/layout
  components/
    roadmap/              ← Roadmap canvas, nodes, editor
  context/
    ChatContext.tsx       ← Agent chats store (modal, /chat page, sidebar, roadmap/board markers)
  lib/
    core.ts               ← ALL file system logic (shared by API routes + MCP)
    events.ts             ← In-process SSE event bus (singleton)
docs/                     ← VibeDoc's own documentation (this project)
plans/tasks/              ← Development tasks
plans/roadmap/            ← Roadmap items (R*.md) + layout.json
memory/MEMORY.md          ← Session handoff
```

## Commands
```bash
npm install               # install deps
npm run dev               # start dev server → http://localhost:3000
npm run build             # production build
npm run lint              # lint

# Point at a target project:
VIBEDOC_ROOT=/path/to/project npm run dev
```

## Key architecture rules
- **`src/lib/core.ts` is the only place that touches the file system.** API routes import from core, never use `fs` directly.
- **`src/lib/events.ts` is the only SSE bus.** Call `emitUpdate()` from API routes after mutations — never from `core.ts`.
- **`page.tsx` is a single client component.** All data fetching is via `fetch()` to our own API routes. No server components in the main UI (real-time state management requires client).
- **`/api/mcp` is hand-rolled JSON-RPC.** Do NOT introduce the MCP SDK stdio transport — it doesn't work in Next.js API routes. Stay with the HTTP JSON-RPC approach.
- **No database.** All state lives in the target project's files. VibeDoc writes only `.vibedoc-activity.json` (incl. `doc_updated` edits), task status plus the `**Owner:**` / `**Started:**` / `**Done:**` / auto `**Due:**` meta lines, task title/meta edits, task `## Manual tests` / `## Review` sections, task/doc create · rename · delete (and Undo restores), a doc's frontmatter properties, MEMORY.md, knowledge entries (`memory/entries/E*.md`), the managed `<!-- vibedoc:entries:start/end -->` block in `AGENTS.md` / `CLAUDE.md` (R052 export; nothing outside it), dismissed memory cleanup flags (`memory/.cleanup.json`), last-recalled dates of knowledge entries (`memory/.recall-log.json`), `plans/roadmap/R*.md`, `plans/roadmap/layout.json`, `.vibedoc/settings.json` (`statuses`, `tasks.sizeDays`, `frontend` override), `.vibedoc/views.json`, saved agent chats (`.vibedoc/chats/*.json`), session episodes (`.vibedoc/episodes/*.md`) and MEMORY.md snapshots (`.vibedoc/memory-history/*.md`, newest 20) into the project.

## Non-negotiables
- Never import `fs` outside of `src/lib/core.ts`
- Never use `localStorage` — SSR/client mismatch
- Never use a CSS-in-JS library — Tailwind only
- Never add a database — file system is the source of truth
- Always call `emitUpdate()` after any mutation in an API route (triggers SSE to browser)
- Always test that `npm run build` passes before marking a task done

## Environment
```
VIBEDOC_ROOT=<path>   # target project root (defaults to process.cwd())
PORT=3000
```

## Read before coding
- @docs/architecture/01-overview/DOMAIN_MAP.md
- @docs/architecture/02-high-level-design/HLD.md
- @memory/MEMORY.md
