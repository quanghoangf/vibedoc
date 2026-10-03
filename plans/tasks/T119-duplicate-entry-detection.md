# T119: Duplicate entry detection
**Status:** 📋 Ready
**Phase:** R051 — Memory cleanup & staleness
**Size:** M
**Depends on:** T118

## Goal
The Cleanup panel suggests merging entries that say the same thing, e.g. two conventions both about "only core.ts touches fs". It shows them as a pair (or group) with a similarity score. Approving comes in the next task.

## Context
- Epic: `plans/roadmap/R051-memory-cleanup-and-staleness.md`
- `HealthFlag` (kind `duplicate`, `suggestion: { action: 'merge', ids }`) and the Cleanup panel exist (previous tasks).
- Decided: keyword overlap only, no embeddings and no LLM call. Reuse `tokenize()` from `src/lib/recall.ts` (T065) so stopwords match recall.
- Project rules: pure logic in `src/lib/*.ts` with a `*.check.mts` self-check.

## Scope
- [ ] `memory-health.ts`: `findDuplicates(entries, opts?)` returns `duplicate` flags
- [ ] `getMemoryHealth` includes them
- [ ] Cleanup panel: a "Possible duplicates" group showing each group's ids, summaries and score, with a disabled "Merge…" button placeholder that the next task wires up
- [ ] Self-check cases

**Out of scope:** the merge action (next task), entries that contradict each other (out of the epic).

## Files
- `src/lib/memory-health.ts`, `src/lib/memory-health.check.mts`
- `src/lib/core.ts`: `getMemoryHealth`
- `src/components/memory/CleanupPanel.tsx`

## Implementation notes
- Similarity is Jaccard over token sets, weighted toward the summary: `0.6 * J(summary) + 0.4 * J(summary + body)`. A pair is a duplicate when the score ≥ `0.5` (`opts.threshold`). Pick the threshold with the self-check fixture and write the chosen value in a comment.
- Different types can still be duplicates, but take 0.1 off the score when the types differ.
- Group transitively (E1~E2, E2~E3 → one group [E1,E2,E3]). The flag id is `duplicate:` + the sorted ids joined with `+`, so a dismissal survives until the group changes.
- Message: `E004 and E011 look like duplicates (82%)`. Severity `info`, so it never shows as a warning in `vibedoc_read_memory`.
- With n entries this is O(n²). That's fine up to a few hundred entries. Add a `ponytail:` comment noting the limit.

## Acceptance criteria
- [ ] Two entries "Only core.ts touches the file system" / "Only core.ts may touch fs" are flagged as a pair
- [ ] "Tailwind only" and "No database" are not flagged
- [ ] Three mutually similar entries form one group, not three pairs
- [ ] The self-check covers the threshold, the type penalty, transitive grouping, stable flag ids, and a 200-entry fixture with no false positives

## Verify
```bash
node src/lib/memory-health.check.mts
pnpm typecheck && pnpm build && pnpm lint
curl -s localhost:3000/api/memory/health | grep duplicate
```
