# R093: Doc usage signals
**Parent:** R004
**Status:** planned
**Order:** 140
**Tasks:** —

The user sees which docs agents actually read, which they never open, and what they searched for and didn't find, so docs effort goes where agents need it. Adapted from Fern's docs analytics (top pages, empty searches, LLM traffic).

**In scope:** record `vibedoc_read_doc` reads and zero-result searches in `.vibedoc/doc-usage.json` (new write, add it to CLAUDE.md's list); /docs view: most read by agents, never read, searched but not found
**Out of scope:** human page views, sending anything off the machine
**Done when:** after a session, /docs shows the docs the agent read and a search that found nothing
