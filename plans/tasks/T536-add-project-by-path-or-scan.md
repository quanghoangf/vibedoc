# T536: Add projects by path or by scanning a folder
**Status:** 📋 Todo
**Phase:** R101 — Import projects
**Size:** M (2–3 hrs)
**Depends on:** T531
**Covers:** S1

## Goal
From All projects, the user adds one repo by its path, or scans a folder like `~/work` and ticks which repos to add, so a hub of many repos takes a minute.

## Context
- Epic: `plans/roadmap/R101-import-projects.md`
- Decision: a "repo" in a scan = a direct child folder (depth ≤ 2) with `.git`, same test as the CLI (`bin/repo-root.mjs`, T533); skip `node_modules` and dot folders; cap 200 results. Already-known roots are listed greyed as "In the hub", unticked.
- Path input is a plain text field (`~` expanded server-side); no native folder picker.
- A new project with no docs or roadmap opens on `/start` (R082 already decides that from the files).
- Writes go through core `addHubProject` (T534).

## Scope
- [ ] core `scanForRepos(dir)` → `{root, name, inHub}[]`; pure filter in `src/lib/hub.ts` (+ check)
- [ ] `GET /api/projects/scan?dir=` and reuse `POST /api/projects/add` (accepts `roots: []`)
- [ ] All projects: "Add project" menu → "From a folder path" / "Scan a folder" dialog with checkboxes, task counts after adding
- [ ] i18n in `src/i18n/projects.ts`

**Out of scope:** cloning (T537); importing tasks from other trackers.

## Files
- `src/lib/hub.ts` (+ `hub.check.mts`), `src/lib/core.ts`
- `src/app/api/projects/scan/route.ts` — new; `src/app/api/projects/add/route.ts`
- `src/components/projects/AddProjectDialog.tsx` — new
- `e2e/projects-hub.mjs`

## Acceptance criteria
- [ ] Scan a fixture folder with 8 repos (2 already in the hub): 6 offered, only ticked ones added (epic Done when with 5)
- [ ] Path to a non-directory or a missing path → error in words, nothing added
- [ ] Added projects show their task counts on All projects

## Manual tests
- [ ] S1 — WHEN the user scans a folder with 8 repos, 2 already in the hub → THEN 6 are offered, and only the ticked ones are added

## Verify
```bash
node src/lib/hub.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/projects-hub.mjs
```
