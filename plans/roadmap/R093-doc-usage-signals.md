# R093: Doc usage signals
**Parent:** R004
**Status:** planned
**Order:** 140
**Tasks:** T480, T481

The user sees which docs agents actually read, which they never open, and what they searched for and didn't find, so docs effort goes where agents need it. Adapted from Fern's docs analytics (top pages, empty searches, LLM traffic).

**In scope:** record `vibedoc_read_doc` reads and zero-result searches in `.vibedoc/doc-usage.json` (new write, add it to CLAUDE.md's list); /docs view: most read by agents, never read, searched but not found
**Out of scope:** human page views, sending anything off the machine
**Done when:** after a session, /docs shows the docs the agent read and a search that found nothing

## Scenarios

### S1: The docs agents read
- WHEN an agent reads a doc with `vibedoc_read_doc`
- THEN /docs lists that doc under "Read by agents" with its read count, without a reload

### S2: Docs agents never open
- WHEN a doc in the project has never been read by an agent
- THEN /docs lists it under "Never read by agents"

### S3: Searches that found nothing
- WHEN an agent's `vibedoc_search_docs` returns no results
- THEN /docs lists that query under "Searched, not found", and it leaves the list once the same search finds a doc
