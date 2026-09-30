# T065: vibedoc_recall — compact ranked list by topic or keyword
**Status:** ✅ Done
**Phase:** R048 — Token-cheap recall
**Size:** M
**Depends on:** T087 (R046 entries)
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
An agent calls `vibedoc_recall { query: "sse events" }` and gets back a short ranked list of matching knowledge entries, one line each (id, type, summary, rough token cost), not the full bodies. This is the thin end-to-end path of the epic: it proves recall works before we add budgets and suggestions.

## Context
- Epic: `plans/roadmap/R048-token-cheap-recall.md`
- R046 (Project knowledge entries) has shipped: `listEntries(root)` in `core.ts` returns `Entry = { id, type, summary, body, updatedAt, file }` from `src/lib/entries.ts`, which maps 1:1 onto `RecallEntry`. Ids are normalized with `normalizeEntryId()`.
- Decided: keyword matching only. No vector or semantic search (out of scope for the epic).
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches the file system. `/api/mcp` is hand-rolled JSON-RPC, so don't add the MCP SDK. Pure logic goes in its own `src/lib/*.ts` with a `*.check.mts` self-check, the way `work-queue.ts` does (T030).

## Scope
- [ ] `src/lib/recall.ts` (new, pure, no fs): `tokenize()`, `estimateTokens()`, `rankEntries()`, `formatCompactLine()`
- [ ] `src/lib/recall.check.mts` (new): assert-based self-check
- [ ] `core.ts`: `recallEntries(query, opts, root)` gets the entries through R046's list function and passes them to `rankEntries`
- [ ] `/api/mcp`: register `vibedoc_recall` and handle it

**Out of scope:** fetching full entries (t2), session-start budget (t3), suggestions on claim (t4).

## Files
- `src/lib/recall.ts`: new
- `src/lib/recall.check.mts`: new
- `src/lib/core.ts`: add `recallEntries()` next to R046's entry functions
- `src/app/api/mcp/route.ts`: tool definition next to the other memory tools, plus a `case`

## Implementation notes
Pin this shape, because t2–t4 build on it. Map R046's entry type onto `RecallEntry` in `core.ts` and keep `recall.ts` independent of it:

```ts
export type RecallEntry = { id: string; type: string; summary: string; body: string; updatedAt: string }
export type RecallHit = { id: string; type: string; summary: string; tokens: number; score: number }
export function tokenize(s: string): string[]              // lowercase, split on non-alphanumerics, drop stopwords and 1-char tokens
export function estimateTokens(s: string): number          // Math.ceil(s.length / 4)
export function rankEntries(entries: RecallEntry[], query: string, opts?: { type?: string; limit?: number }): RecallHit[]
export function formatCompactLine(h: RecallHit): string   // "E012 · convention · Only core.ts touches fs (~120 tok)"
```

Scoring: for each query token, +3 if it's in the summary, +2 if it matches the id or type, +1 if it's in the body (count once per token). Drop entries that score 0. Break ties by `updatedAt`, newest first. `limit` defaults to 10. `type` is an exact filter.

MCP `vibedoc_recall` input: `{ query: string (required), type?: string, limit?: number }`. Output: a header (`N matches for "…"`), then one compact line per hit, then the footer `Fetch full entries with vibedoc_get_entries { ids: [...] }`. If nothing matches, return one line saying so. Tool description: "Search memory entries by topic or keyword. Returns a compact list (id, type, summary); fetch bodies with vibedoc_get_entries."

## Acceptance criteria
- [ ] With entries about "SSE bus", "Tailwind only" and "no database", the query `sse events` returns the SSE entry first
- [ ] Output contains no entry bodies, only compact lines
- [ ] `type` filter and `limit` work
- [ ] An empty or all-stopword query returns a clear message, not a crash
- [ ] Unit tests in `recall.check.mts` cover: tokenizer and stopwords, the scoring weights, tie-break by recency, the type filter, the limit, and a fixture of 200+ synthetic entries where the target entry is in the top 10

## Verify
```bash
node src/lib/recall.check.mts
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_recall","arguments":{"query":"sse events"}}}'
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Save three entries with vibedoc_save_entry (e.g. "The SSE bus lives in events.ts", "Tailwind only", "No database"), then ask an agent to call vibedoc_recall with query "sse events" → the SSE entry is the first line, shown as "E00N · convention · <summary> (~N tok)"
- [ ] Check the recall reply → it has a "N matches for …" header, one line per entry, a vibedoc_get_entries footer, and no entry bodies
- [ ] Call vibedoc_recall with type "decision" → only decision entries are listed
- [ ] Call vibedoc_recall with query "the and" → a message asking for topic words, not an error
- [ ] Call vibedoc_recall with a word no entry has → "No entries match …"
### Regression risk
- [ ] vibedoc_read_memory still ends with the full "## Knowledge entries (N)" index
