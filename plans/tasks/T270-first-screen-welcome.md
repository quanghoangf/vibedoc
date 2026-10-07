# T270: First-screen decision and the welcome page (docs / empty project)
**Status:** 📋 Todo
**Phase:** R082 — Smart first screen
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1, S2

## Goal
Opening VibeDoc lands on a screen that fits the project: a project with no tasks and no roadmap gets a welcome page offering the right first move (docs → plan the roadmap from them; empty → plan the first epics with the agent), and a set-up project goes straight to the board. `vibedoc` no longer opens the template wizard.

## Context
- Epic: `plans/roadmap/R082-smart-first-screen.md`
- Decisions from the breakdown:
  - "Set up" = the project has at least one task or one roadmap item (matches the spec change "skip it on projects that already have tasks or a roadmap"). Derived on every open, nothing stored.
  - "Has docs" = at least one `.md` outside `plans/`, `memory/`, dot-folders and `node_modules`, ignoring `LICENSE*`, `CHANGELOG*` and `CONTRIBUTING*` (README, CLAUDE.md, AGENTS.md and `docs/**` count).
  - Both starts go through the agent chat (`askAgent()` in `src/lib/ask-agent.ts`): `generateRoadmap()` in core only reads ROADMAP.md and tasks, never the docs, while the `/vibedoc:roadmap` skill (which the chat reads) scans the docs. Docs project → primary "Generate roadmap from your docs" = `askAgent("Plan a roadmap for this project from its docs.", { newChat: true })`. Empty project → primary "Plan the first epics with the agent" = `askAgent("Plan the first epics for this project.", { newChat: true })`. Both also show a quiet "Go to the board" link.
  - The decision happens in the root `src/app/page.tsx` (already a server component that redirects): it calls core and redirects to `/welcome` or `/board`, keeping `?root=`. Demo mode (`isDemo()` in `src/lib/demo.ts`) always goes to `/board`.
- CLAUDE.md: "Only `src/lib/core.ts` touches the file system" — the page imports core functions, never `fs`. "No hardcoded UI text in components" — text in a new `src/i18n/welcome.ts` (`en` + typed `vi`), merged in `src/i18n/index.ts`. "Pure libs never import values from each other."
- Seams owned by sibling epics, don't build them: R080 owns the CLI startup (port, printed URLs, open-when-ready) — this task only changes the opened path; R081 owns the Connect panel (T271 adds the slot); R085 owns "Try the demo".

## Scope
- [ ] `src/lib/first-screen.ts` (pure): `hasProjectDocs(paths: string[]): boolean` and `firstScreen({ tasks, roadmapItems, docPaths, demo }): 'board' | 'welcome'` plus `welcomeKind(docPaths): 'docs' | 'empty'`; self-check `src/lib/first-screen.check.mts`
- [ ] `src/app/page.tsx`: read `searchParams.root` (fall back to the configured root as the API routes do), call `listTasks` / `listRoadmap` / `listDocs`, redirect to `/welcome?root=…` or `/board?root=…` (no `root` param when none was given)
- [ ] `src/app/(app)/welcome/page.tsx`: client page; fetches what it needs through existing API routes (`/api/docs`, `/api/tasks`, `/api/roadmap`) with `rootParam`; shows the docs variant or the empty variant, one primary button + "Go to the board"
- [ ] `src/i18n/welcome.ts` (en + vi), registered in `src/i18n/index.ts`
- [ ] `bin/vibedoc.mjs`: open `http://localhost:<port>/` instead of `/setup`
- [ ] `e2e/i18n.mjs`: add `/welcome` to `PAGES` (its route check fails otherwise)
- [ ] New `e2e/first-screen.mjs`: a docs-only fixture opens `/` → lands on `/welcome` with "Generate roadmap from your docs" first; an empty fixture → `/welcome` with "Plan the first epics with the agent"; a fixture with a task → `/board`

**Out of scope:** Agent-connected status, the Connect slot and the "Write project docs" action (T271); reopening the last page (T272); what the wizard generates; a product tour; the CLI's port and ready logic (R080).

## Files
- `src/lib/first-screen.ts`, `src/lib/first-screen.check.mts` — new
- `src/app/page.tsx` — the decision + redirect
- `src/app/(app)/welcome/page.tsx` — new
- `src/i18n/welcome.ts` — new; `src/i18n/index.ts` — register it
- `bin/vibedoc.mjs` — opened path
- `e2e/i18n.mjs`, `e2e/first-screen.mjs`

## Implementation notes
- Root resolution: see how API routes resolve `?root=` (`rootOf` in `src/app/api/roadmap/_shared.ts`, and `getConfiguredRoot()` / `findRoot()` in core). Reuse, don't re-implement.
- `listDocs(root)` returns `DocFile[]` with a `path` — pass the paths to the pure lib.
- e2e fixtures: `makeFixture()` in `e2e/stub-chat.mjs` makes a roadmap, so the first-screen fixtures build their own temp dirs (`mkdtempSync`) and open `${BASE}/?root=<dir>`; remove them in `finally`. Run against `BASE=http://localhost:3082`.
- The welcome must not flash: render nothing until the fetch resolves. Mark nothing as `data-user-content` unless it shows project text.
- Layout: centred column, Tailwind tokens already used in `EmptyState` (`components/shared`), primary button style as the roadmap empty state (`bg-accent text-accent-fg`).

## Acceptance criteria
- [ ] Docs, no tasks/roadmap: `/` → `/welcome`, the first button is "Generate roadmap from your docs" and opens an agent chat with the docs prompt
- [ ] No docs, no tasks/roadmap: `/` → `/welcome` offering "Plan the first epics with the agent"
- [ ] A project with a task or roadmap item: `/` → `/board`, no welcome
- [ ] `vibedoc` with no flags opens `/`, not `/setup`
- [ ] `node src/lib/first-screen.check.mts` passes; `e2e/first-screen.mjs` passes; `/welcome` passes `e2e/i18n.mjs` in Vietnamese

## Verify
```bash
node src/lib/first-screen.check.mts
pnpm build && pnpm lint
PORT=3082 pnpm start &   # or pnpm dev -p 3082
BASE=http://localhost:3082 PW_DIR=. node e2e/first-screen.mjs
BASE=http://localhost:3082 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
- [ ] S1 — WHEN VibeDoc opens a project that has docs but no roadmap for the first time → THEN the welcome offers "Generate roadmap from your docs" first
- [ ] S2 — WHEN VibeDoc opens a project with no docs or tasks → THEN the welcome offers to plan the first epics with the agent
