# Vision
**Last updated:** 2025-02-28

## Vision statement
VibeDoc makes AI-assisted development feel like pair programming with a team member who remembers everything. Your AI agent navigates your architecture docs, manages tasks, logs decisions, and hands off session state — all visible to you in real time through a browser UI.

## The core insight
The UI and the AI agent share the same backend. One running process (`npm run dev`), two clients: your browser and your AI coding tool. When the AI moves a task from `in-progress` to `done`, you see the card animate across the kanban board — live, via SSE.

## Goals
- **Zero friction setup** — `npm install` + one env var, works with any existing project that has a `CLAUDE.md`
- **Real-time** — no polling, no refresh. AI actions appear in the browser the moment they happen
- **File-system native** — no database, no sync. Reads and writes your actual repo files
- **Multi-project** — switch between projects from the UI
- **Self-hosting ready** — runs on any Node.js server for team use

## Non-goals
- Not a code editor — VibeDoc doesn't edit source code, only docs/tasks/memory
- Not a git client — no commits, diffs, or branch management
- Not a project manager for non-technical users — designed for developers working with AI agents
- Not a cloud SaaS (yet) — local-first by design

## Success metrics
| Metric | Target |
|--------|--------|
| Time from clone to running | < 2 minutes |
| AI agent can orient itself in < 3 tool calls | vibedoc_read_memory → vibedoc_get_status → ready |
| Real-time latency (AI action → browser update) | < 500ms |
| Works with zero existing docs | graceful empty state |
