# T184: vibedoc_spec_context: gather a capability's history to draft its spec
**Status:** 👀 Review
**Phase:** R066 — Living capability specs
**Size:** M (2–3 hrs)
**Depends on:** T183
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
An existing project can get its first specs without someone rewriting history by hand: one tool call gives the agent everything already written about a capability, the agent drafts the spec, and the human accepts it as a diff.

## Context
- Epic: `plans/roadmap/R066-living-capability-specs.md`.
- Decision: VibeDoc only **gathers**; the agent writes the draft and proposes it with `vibedoc_propose_edit` (empty `old_string` = new doc), and the human accepts it in the chat. VibeDoc never writes a spec on its own.
- Similar "preview, human decides" pattern: `vibedoc_import_memory` (R052).

## Scope
- [ ] `vibedoc_spec_context { capability, epics?: string[], query?: string }`:
  - Epics: the given ids, else epics whose title/body match `capability`/`query` (keyword, reuse `tokenize`).
  - For each epic: title, "Done when", and its done tasks' Goal + Acceptance criteria (not full bodies).
  - Related docs (`searchDocs`), knowledge entries (`rankEntries`), the existing spec if any.
  - Ends with instructions for the agent: the spec format (from T181's template), "write observable behaviour, not implementation", "propose with vibedoc_propose_edit at docs/specs/<capability>.md".
- [ ] Cap the output (~6k tokens; cut the oldest tasks first and say how many were cut).
- [ ] Doc: `docs/architecture/mcp-tools.md`.

**Out of scope:** a UI button for drafting (the agent chat already has propose/accept), automatic writes, spec deltas (R069).

## Files
- `src/app/api/mcp/route.ts`, `src/lib/core.ts` (`getSpecContext`)
- `src/lib/specs.ts`: `formatSpecContext(...)` (pure) + check cases

## Implementation notes
- Pull Goal / Acceptance criteria with the same section regex style as `taskQuery()` in recall.ts.
- Keep the budget logic close to `fitToBudget()` (recall.ts); don't import it into specs.ts, pass a token count in from core.

## Acceptance criteria
- [ ] `vibedoc_spec_context { capability: "board-views" }` on this repo returns R-epics and done tasks about board views, plus related docs and entries, within the cap.
- [ ] An agent chat asked "draft the board-views spec" ends in a propose_edit card for `docs/specs/board-views.md`; Accept creates the file.
- [ ] Unknown capability with no matches → a clear "nothing found, pass epics:" message.

## Verify
```bash
node src/lib/specs.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Ask an agent to call vibedoc_spec_context { capability: "board-views" } on this repo → it lists R005 Kanban board with its done tasks, related docs (DESIGN.md "Board Views") and ends with "How to draft the spec"
- [ ] vibedoc_spec_context { capability: "board-views", epics: ["R056"] } → only R056 and its done tasks (Goal + Acceptance), with "(N older tasks cut to fit)" if it is over the cap
- [ ] vibedoc_spec_context { capability: "quantum-flux" } → "Nothing found for "quantum-flux" … Pass epics:"
- [ ] In an agent chat, ask "draft the board-views spec" → the chat ends in a propose-edit card for docs/specs/board-views.md; Accept creates the file and it shows with the Capability spec chip in /docs
### Regression risk
- [ ] Other propose-edit flows in the chat (edit an existing doc) still show the diff and Accept still applies it
