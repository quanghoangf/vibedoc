# T066: vibedoc_get_entries — fetch full entries by id
**Status:** 📋 Ready
**Phase:** R048 — Token-cheap recall
**Size:** S
**Depends on:** T065

## Goal
After recall, an agent fetches only the entries it needs in full: `vibedoc_get_entries { ids: ["E012", "E030"] }`. This is the second half of "index first, bodies on request".

## Context
- Epic: `plans/roadmap/R048-token-cheap-recall.md`
- Builds on `RecallEntry` and the entry loading in `core.ts` from t1 (R046 entries).
- Project rules: only `core.ts` touches fs. The endpoint is hand-rolled JSON-RPC.

## Scope
- [ ] `core.ts`: `getEntriesByIds(ids, root)` returns the entries found and the ids that weren't found
- [ ] `/api/mcp`: register `vibedoc_get_entries` and handle it

**Out of scope:** editing entries (R046/R047), the session budget (t3).

## Files
- `src/lib/core.ts`: add `getEntriesByIds()`
- `src/app/api/mcp/route.ts`: tool definition and `case`

## Implementation notes
- Input `{ ids: string[] }`, required. Cap it at 20 ids per call; above that, return a JSON-RPC error that tells the agent to split the call.
- Output one block per entry: `## E012 · convention · <summary>`, a line `updated <date>`, then the body. Keep the order of `ids`. End with `Not found: E999` when some ids are missing.
- Match ids case-insensitively (`e12` and `E012` should both work if R046 zero-pads; reuse its id normalisation if it has one).

## Acceptance criteria
- [ ] Two valid ids return both full bodies in the requested order
- [ ] Unknown ids are listed as not found; the call still returns the valid ones
- [ ] More than 20 ids → clear error
- [ ] Empty `ids` → clear error

## Verify
```bash
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_entries","arguments":{"ids":["E001","E999"]}}}'
```
