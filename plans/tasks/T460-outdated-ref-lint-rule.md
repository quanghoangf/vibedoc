# T460: "May be outdated" lint rule from done tasks' renames
**Status:** 📋 Todo
**Phase:** R092 — Doc upkeep agent
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1

## Goal
A doc that still names a path a done task renamed or deleted gets an `outdated-ref` issue in the docs check, so agents (`vibedoc_check_docs`) and `GET /api/docs/lint` see it.

## Context
- Epic: `plans/roadmap/R092-doc-upkeep-agent.md`
- Derived on read, never stored (like R067's outdated verifications). Self-clearing: the issue is gone once the doc no longer names the old path, or the old path exists again.
- Only renames and deletes count (provable: the named path no longer exists). Modified files are out: they would flag every doc naming `src/lib/core.ts` after every task.
- The doc graph only extracts backticked `.md` paths, so match changed paths as literal text in the doc (full relative path, bounded by non-path characters). Basename-only mentions (`core.ts`) are a known ceiling.
- Only doc kinds `doc` / `adr` / `spec` (`docNode(path).kind`), never task / epic / entry files (a task names the file it renamed).
- One git spawn per lint: `git log -M --name-status -n 500`, keep commits whose subject names a done task (`\bT123\b`, as `getVerifyContext` filters). Git missing → no outdated issues, warn in the log.
- CLAUDE.md: only `core.ts` touches fs/git; pure libs never import values from each other.

## Scope
- [ ] Pure `src/lib/doc-upkeep.ts`: `parseNameStatusLog(stdout)` → commits `{sha, subject, changes: [{status: 'R'|'D', from, to?}]}`; `outdatedRefs({docs, commits, doneTaskIds, exists})` → `[{path, line, taskId, from, to}]` (first line naming the old path, newest commit wins per old path).
- [ ] `src/lib/doc-lint.ts`: rule `outdated-ref` (warn), `LintOptions.outdated`, issue `target` = old path, optional `task` field, message `` `old` was renamed to `new` by T001 `` / `` `old` was deleted by T001 ``.
- [ ] `getDocLint()` in core computes it (done task ids from `listTasks`, `exists` from fs).
- [ ] `DocLintPanel` rule label (`Record<LintRule, MessageKey>` forces it) en + vi.
- [ ] `node src/lib/doc-upkeep.check.mts` self-check.

**Out of scope:** UI badge and Fix docs (T461); modified files; basename mentions.

## Files
- `src/lib/doc-upkeep.ts`, `src/lib/doc-upkeep.check.mts` — new
- `src/lib/doc-lint.ts` — rule + option
- `src/lib/core.ts` — `getDocLint`
- `src/lib/mcp-tools.ts` — mention renamed/deleted paths in `vibedoc_check_docs` description
- `src/components/docs/DocLintPanel.tsx`, `src/i18n/docs.ts`

## Acceptance criteria
- [ ] Fixture: commit `refactor: move (T001)` renames `src/a.ts` → `src/b.ts`, T001 done, `docs/guide.md` names `src/a.ts` → `vibedoc_check_docs` lists `warn outdated-ref` on that line naming `src/b.ts` and T001.
- [ ] T001 not done, or the doc no longer naming `src/a.ts` → no issue. `plans/tasks/T001-*.md` naming it → no issue.
- [ ] Self-check covers rename, delete, word boundary (`src/a.tsx` is not `src/a.ts`), newest commit wins.

## Verify
```bash
node src/lib/doc-upkeep.check.mts && node src/lib/doc-lint.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
```

## Manual tests
- [ ] S1 — WHEN a done task's commits rename or delete a file and a doc still names its old path → THEN that doc is flagged "may be outdated" with the task and the old → new path, and the flag clears once the doc no longer names it
