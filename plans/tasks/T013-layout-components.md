# T013: Extract layout components — AppHeader, AppSidebar, ProjectSwitcher
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** M (2 hrs)
**Depends on:** T008

## What to build
Extract the top bar, sidebar, and project switcher dropdown into dedicated layout components.

## Scope
- [x] Create `src/components/layout/LiveIndicator.tsx`
- [x] Create `src/components/layout/StatsPills.tsx`
- [x] Create `src/components/layout/ProjectSwitcher.tsx` — uses shadcn DropdownMenu
- [x] Create `src/components/layout/AppHeader.tsx` — logo + ProjectSwitcher + StatsPills + LiveIndicator + MCP hint
- [x] Create `src/components/layout/AppSidebar.tsx` — nav buttons + board stats
- [x] Create `src/components/layout/AppShell.tsx` — min-h-screen flex flex-col wrapper

## Acceptance criteria
- [x] Project switcher shows all projects, clicking switches
- [x] Live indicator flashes on SSE events
- [x] Stats pills show correct task counts

## Definition of done
Header renders correctly with all elements, project switching works.
