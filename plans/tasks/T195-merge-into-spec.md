# T195: "Merge into spec" on a done epic
**Status:** 👀 Review
**Phase:** R069 — Spec changes on epics
**Size:** M (2–3 hrs)
**Depends on:** T194
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
Finishing an epic that changes a capability ends with one reviewed click that updates the capability spec, so specs stay current without anyone rewriting them.

## Context
- Epic: `plans/roadmap/R069-spec-changes-on-epics.md`. "Done when": finishing an epic that modifies one requirement produces a one-click diff, and accepting it updates the capability spec.
- Decision: a button on the epic sheet (`RoadmapItemSheet.tsx`), shown when the epic is done, has `## Spec changes`, and has no `**Spec merged:**` line. A drift warning (T196) covers the forgotten case.
- Reuse: `src/lib/diff.ts` (the chat's propose-edit diff), `PUT /api/docs` / `editDoc()` / `writeDoc` in core for the write, `updateRoadmapItem` replace-or-insert meta for `**Spec merged:** YYYY-MM-DD` (local date, like `**Due:**`).
- Rules: only core touches fs; `emitUpdate()` after the write (`doc_updated` for each spec, `roadmap_updated` for the epic).

## Scope
- [ ] core `previewSpecMerge(epicId, root)` → per capability `{ path, before, after, errors }` (uses `applyDelta`).
- [ ] core `applySpecMerge(epicId, root, actor)` → recomputes from the current files (never trusts the client's text), refuses when any capability has errors, writes the specs, stamps `**Spec merged:**`, logs one activity row.
- [ ] Routes: `GET /api/roadmap/spec-merge?id=` and `POST /api/roadmap/spec-merge { id }`.
- [ ] Sheet: "Merge into spec" → dialog with the diff per capability and errors listed → Accept. After merge the sheet shows "Spec merged <date>" with links to the specs.
- [ ] MCP: `vibedoc_get_roadmap` / the epic lines say "spec changes not merged" when applicable (agents shouldn't merge; humans do).

**Out of scope:** merging partially, editing the merged text in the dialog (edit the spec afterwards).

## Files
- `src/lib/core.ts`, `src/app/api/roadmap/spec-merge/route.ts`: new
- `src/components/roadmap/RoadmapItemSheet.tsx` (+ a small dialog component next to it)

## Acceptance criteria
- [ ] Done epic modifying one requirement → Merge → diff shows only that requirement → Accept → spec updated, `**Spec merged:**` written, the open doc in /docs updates live.
- [ ] An error (MODIFIED on a missing requirement) disables Accept and names the requirement.
- [ ] The button is hidden for epics without `## Spec changes` or already merged.

## Verify
```bash
node src/lib/specs.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-05 — ai · Spec: `e2e/vibedoc/T195-merge-into-spec.spec.ts` · Auto: passed 2026-10-05_
### Steps
- [x] 🤖 Open a done epic whose spec changes modify one requirement and click Merge into capability spec → the dialog shows the old line removed and the new line added
- [x] 🤖 Click Accept → the sheet reads "Capability spec merged" with a link to the spec, and the Merge button is gone
- [x] 🤖 Click the spec link → the capability spec opens with the new requirement text
- [x] 🤖 Open a done epic whose change modifies a missing requirement and click Merge → the dialog names "Missing one" and Accept is disabled
- [ ] With the capability spec open in /docs in another tab, merge from the epic sheet → the open editor shows the new text without a reload, and no "AI edited" marker
- [ ] vibedoc_get_roadmap on a done epic with unmerged spec changes → its line ends with "spec changes not merged"
### Regression risk
- [ ] Epics without `## Spec changes` (or not done yet) show the same footer as before: no Merge button
