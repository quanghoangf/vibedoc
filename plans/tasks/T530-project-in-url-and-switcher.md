# T530: Project in the URL, quick switch and last page per project
**Status:** ✅ Done
**Phase:** R099 — Projects hub
**Size:** M (2–3 hrs)
**Depends on:** T529
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16
**Done:** 2026-10-16

## Goal
The project a tab shows is part of its URL, so links, reloads and the switcher all land on the same project, and switching returns to the page last used there.

## Context
- Epic: `plans/roadmap/R099-projects-hub.md`
- Decision: identity in the browser = `?project=<id>` (the hub id from T529), never a path prefix (that would touch every route). AppContext resolves id → root and keeps building `rootParam` (`?root=`) for the API exactly as today.
- No `?project=` → the configured root's project. Unknown id → the configured root plus a toast.
- `vibedoc-last` (R082, `src/lib/first-screen.ts`) becomes per project: cookie value `<id>:<path>` pairs, newest 20; `lastPageTarget` takes the project id.
- Opening a project stamps `lastOpened` (`POST /api/projects/open {id}`) so All projects (T531) sorts by it.
- Rule: no hardcoded UI text, add strings to `src/i18n/<area>.ts` (`en` + `vi`).

## Scope
- [ ] AppContext: read `?project=` on load and on `popstate`; `onProjectChange(id)` writes it with `history.replaceState`, keeps the other query keys
- [ ] Every in-app link/`router.push` keeps `?project=` (a small `withProject(href)` helper next to `rootParam`)
- [ ] `ProjectSwitcher.tsx`: pinned first, then by `lastOpened`; archived hidden; ⌘K command "Switch project…"
- [ ] Per-project last page in `first-screen.ts` + `src/app/page.tsx` redirect keeps `?project=`
- [ ] `POST /api/projects/open` → core `touchProject(id)` + `emitUpdate("projects_updated")`

**Out of scope:** All projects page (T531), missing folders (T532).

## Files
- `src/context/AppContext.tsx` — `activeProject` from the URL; `withProject`
- `src/components/layout/ProjectSwitcher.tsx`, `src/components/layout/CommandPalette.tsx`
- `src/lib/first-screen.ts` (+ `.check.mts`), `src/app/page.tsx`, `src/app/(app)/layout.tsx` (cookie write)
- `src/app/api/projects/open/route.ts` — new
- `src/i18n/shell.ts`

## Implementation notes
- Find link builders with `grep -rn "router.push\|href={\`/" src/components src/app` before adding the helper; reuse it everywhere rather than editing each string by hand.
- `SidebarChats`, deep links `/roadmap?item=`, `/board?task=` must keep the project.

## Acceptance criteria
- [ ] Switching to project B opens B's last page (or `/board`); reload stays on B
- [ ] A copied `/roadmap?project=b&item=R004` link opens B's epic in a fresh tab
- [ ] Unknown `?project=` shows the configured project and a toast
- [ ] `node src/lib/first-screen.check.mts` covers per-project last page
- [ ] New `e2e/projects-hub.mjs` (two fixture roots in one `VIBEDOC_HOME`): switch, reload, deep link

## Verify
```bash
node src/lib/first-screen.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/projects-hub.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] Open `/board?project=<A>` → A's tasks show; open /roadmap there
- [x] Header switcher → pick B → `/board?project=<B>` with B's tasks, none of A's
- [x] Switcher → pick A again → A's last page (/roadmap) opens, not the board
- [x] On B click Roadmap in the sidebar, then reload → URL keeps `?project=<B>`, B's epic still shows
- [x] ⌘K → "Switch project…" → the header switcher opens with the other projects
- [x] Open `/roadmap?project=<B>&item=R002` in a fresh tab → B's epic sheet opens
- [x] Open `/board?project=no-such-project` → the default project and a toast "No project “no-such-project” …"
### Regression risk
- [x] One-project use: `/` reopens the last page used, URLs carry no `?project=` (`e2e/first-screen.mjs` passes)
