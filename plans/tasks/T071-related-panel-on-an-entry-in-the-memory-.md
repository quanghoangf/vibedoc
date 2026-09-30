# T071: Related panel on an entry in the Memory tab
**Status:** 📋 Ready
**Phase:** R053 — Memory graph
**Size:** M
**Depends on:** T069

## Goal
Opening an entry in the Memory tab shows the tasks, epics, ADRs, docs and entries it relates to, split into "Links to" and "Linked from". Clicking one opens it. This covers the first half of the epic's done-when.

## Context
- Epic: `plans/roadmap/R053-memory-graph.md`
- **Blocked on R047 (Memory browser)**, which adds the entry detail view in the Memory tab. This panel goes inside that view.
- Uses `GET /api/memory/graph?entry=<id>` from t1.
- Pattern to copy: `src/components/docs/BacklinksPanel.tsx` (T026): collapsible, lazy fetch on first expand, result cached in state.
- Rules: Tailwind only, no `localStorage`, data only through `fetch()` to our own API routes.

## Scope
- [ ] `src/components/memory/EntryRelated.tsx` (new)
- [ ] Render it in R047's entry detail view
- [ ] Rows grouped by kind (Tasks, Epics, ADRs, Docs, Entries), each with its status icon or label
- [ ] Click: a task opens the task detail panel, an epic opens the roadmap sheet, a doc opens the doc, an entry opens that entry

**Out of scope:** the graph (t5), history (t4), editing links (they come from text, so users edit the entry body).

## Files
- `src/components/memory/EntryRelated.tsx`: new
- R047's entry detail component: render the panel

## Implementation notes
- Unlike BacklinksPanel, start **expanded**, because this is the main point of opening an entry. Fetch when the entry changes.
- Refetch on the SSE update event the Memory tab already listens to, so editing an entry body updates the links.
- Empty state: "No links yet. Mention a task, epic or doc in the entry to link it."
- Reuse the app's single status-icon system (commit 452b1b3) for task and epic rows.

## Acceptance criteria
- [ ] An entry that mentions `T065` and a doc path lists both under "Links to"
- [ ] A task that mentions the entry is listed under "Linked from"
- [ ] Each row opens the right view
- [ ] Adding `R048` to the entry body and saving makes it appear without a reload
- [ ] Empty state shown for an entry with no links

## Verify
```bash
pnpm build && pnpm lint
# pnpm dev → Memory tab → open an entry that mentions a task → click the task row → task detail opens
```
