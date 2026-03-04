# T015 — Collapsible Sidebar

**Status:** done
**Size:** S
**Phase:** UI Polish

## Goal
AppSidebar supports collapsed (icon-only) and expanded states with a toggle button at the bottom.

## Acceptance criteria
- Sidebar collapses to icon-only (`w-12`) and expands to `w-48`
- Smooth `transition-all duration-200`
- Nav items show icon + label when expanded; icon-only + Tooltip on hover when collapsed
- Stats show label+count expanded; count-only + Tooltip collapsed
- ChevronLeft/Right toggle button at bottom
