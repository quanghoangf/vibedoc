# T072: Entry history from git log
**Status:** 📋 Ready
**Phase:** R053 — Memory graph
**Size:** M
**Depends on:** T071

## Goal
On an entry, people can see how the fact changed over time: each commit that touched the entry file, with date, author and message, and the entry's text at that commit.

## Context
- Epic: `plans/roadmap/R053-memory-graph.md` (in scope: "how a fact changed over time")
- Decided: the history comes from **`git log` of the entry file**. Entries are plain files kept in git (R046). Don't use the activity log.
- Project rules: only `core.ts` touches the file system, so git calls (`child_process.execFile`) go there too. Don't use `exec` with string interpolation.

## Scope
- [ ] `core.ts`: `getFileHistory(relPath, root, limit = 20)` and `getFileAtCommit(relPath, sha, root)`
- [ ] `src/app/api/memory/history/route.ts` (new): `GET ?entry=<id>` returns the list, `&sha=` returns the text at that commit
- [ ] `src/components/memory/EntryHistory.tsx` (new): a collapsible "History" section under the Related panel. It fetches lazily when expanded; clicking a row shows that version read-only

**Out of scope:** diffs between versions, restoring an old version (R045 covers restore for MEMORY.md), history in MCP output.

## Files
- `src/lib/core.ts`
- `src/app/api/memory/history/route.ts`: new
- `src/components/memory/EntryHistory.tsx`: new
- R047's entry detail view: render it below `EntryRelated`

## Implementation notes
- `git log --follow --format=%H%x1f%an%x1f%aI%x1f%s -n <limit> -- <relPath>`, run with `cwd: root`. Split on `\x1f`.
- `git show <sha>:<relPath>`. Check that `sha` matches `/^[0-9a-f]{7,40}$/`, and that the entry path resolves inside `root`.
- If the folder isn't a git repo or git is missing, return `{ history: [], reason: 'no-git' }`, and the UI shows "History needs git". Uncommitted changes show one "Uncommitted changes" row at the top (use `git status --porcelain -- <relPath>`).

## Acceptance criteria
- [ ] An entry committed 3 times shows 3 rows, newest first, with author and date
- [ ] Clicking a row shows the entry text at that commit
- [ ] Invalid sha → 400. A path outside the root is rejected
- [ ] A project that isn't a git repo shows "History needs git" instead of an error
- [ ] Nothing is fetched until the section is expanded

## Verify
```bash
pnpm build && pnpm lint
curl -s 'localhost:3000/api/memory/history?entry=E001'
curl -s 'localhost:3000/api/memory/history?entry=E001&sha=zzz'   # 400
```
