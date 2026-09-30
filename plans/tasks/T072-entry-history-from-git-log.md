# T072: Entry history from git log
**Status:** ✅ Done
**Phase:** R053 — Memory graph
**Size:** M
**Depends on:** T071
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

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

## Implementation note (done)
Entry files are matched by id (`:(glob)memory/entries/E001-*.md`), not with `git log --follow`: a new summary renames the file and small files fall under git's rename detection, so `--follow` lost the history before a rename. Each row carries the path the file had after that commit; `?sha=` looks it up server-side (the client never sends a path).

## Verify
```bash
pnpm build && pnpm lint
curl -s 'localhost:3000/api/memory/history?entry=E001'
curl -s 'localhost:3000/api/memory/history?entry=E001&sha=zzz'   # 400
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] In a project that is a git repo, open an entry that has been committed a few times on /memory → a collapsed "History" section under Related; open it → one row per commit, newest first, with date, message and author
- [ ] Change the entry's summary (the file gets a new name), commit, and reopen History → the commits from before the rename are still listed
- [ ] Click an old row → that version's text shows read-only below the list; ✕ closes it
- [ ] Edit the entry without committing → an "Uncommitted changes" row at the top
- [ ] Open History in a project that is not a git repo → "History needs git: this project is not a git repository."
### Regression risk
- [ ] The Related section and Edit / Delete on the entry still work with History open
