# Project Memory
**Last updated:** 2025-02-28

## Current state
Phase 0 is complete. The app runs (`npm run dev`), all 4 tabs load, MCP endpoint is live at `/api/mcp`, SSE works. The project now has its own VibeDoc documentation applied — CLAUDE.md, architecture docs, ADRs, and 6 task files covering Phase 1 and 2 work.

The markdown renderer in the docs tab has a known issue: it's a hand-rolled regex hack that breaks on complex content (nested lists, code blocks with special chars). This is tracked as T005.

## Just completed
- Full VibeDoc documentation applied to the project itself
- CLAUDE.md with stack rules and non-negotiables
- Architecture docs: VISION, DOMAIN_MAP, HLD, service overviews, data architecture
- 4 ADRs documenting key decisions (Next.js, file system, SSE, hand-rolled MCP)
- 6 task files: T001 (drag-drop), T002 (doc editor), T003 (task panel), T004 (shortcuts), T005 (markdown), T006 (task creation)
- plans/PLAN.md with 4-phase roadmap

## Working on now
Nothing — ready for Phase 1 development.

## Up next
1. **T005** — Fix markdown rendering (use `marked`, highest impact, easiest win)
2. **T003** — Task detail panel (click task → slide-in panel)
3. **T001** — Drag-and-drop kanban
4. **T002** — Inline doc editor
5. **T004** — Keyboard shortcuts (depends on T003)

## Active issues
| Issue | Severity | Status |
|-------|----------|--------|
| Markdown renderer breaks on nested lists / complex code blocks | medium | open — tracked as T005 |
| Board tab shows 0 tasks (needs task files) | low | resolved — task files now exist |
| Doc search resets doc list on empty query | low | open |

## Recent decisions
- Start with T005 (markdown fix) because it unblocks all other doc rendering
- Use HTML5 native DnD for T001 — no new npm packages
- Keep page.tsx as single client component — no state library needed at this scale

## Tech debt
- `renderMarkdown()` in page.tsx is a regex hack — replace with `marked` in T005
- No error boundaries in UI — API failures fail silently
- Multi-project scanning is naive (reads all siblings) — needs a depth limit

## Handoff for next session
App is running and documented. All 4 tabs work. Start with **T005** — it's a 1-2 hour fix that makes the docs tab actually readable. File to edit: `src/app/page.tsx`, find the `renderMarkdown()` function near the bottom and replace it with `marked.parse()`. The `marked` package is already in `package.json`. After T005, pick up T003 (task detail panel) — the slide-in panel component should be added to the bottom of `page.tsx` alongside the existing `TaskCard` component.
