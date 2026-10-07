# R087: Agent-ready docs
**Parent:** R003
**Status:** planned
**Order:** 170
**Tasks:** —

Any agent can read the project's docs, even one without MCP: an `/llms.txt` index, each doc as plain markdown at a URL, a short context header on `vibedoc_read_doc`, and notes written only for agents or only for humans. Adapted from Fern's agent-facing docs (llms.txt, `.md` URLs, agent directives, `<llms-only>`), kept local and derived from the files.

**In scope:** `/llms.txt` served on request from `listDocs()` + registry descriptions + `listSpecs()` + open epics (one level via `?section=`); `/md/<path>` and `Accept: text/markdown` return the raw doc, a miss returns up to 5 similar paths (same for `vibedoc_read_doc`); doc actions Copy page, View as Markdown, Copy agent link, Ask agent about this doc (`askAgent()`), also in ⌘K; a one-line header on `vibedoc_read_doc` (path, priority, last edit, inbound links, "propose edits with vibedoc_propose_edit"), off with `docs.agentHeader: false` in settings; `<!-- agent-only … -->` and `<!-- human-only:start/end -->` blocks (pure `src/lib/audience.ts`, fences ignored) applied to every agent output and Copy page, editor toolbar inserts both
**Out of scope:** `llms-full.txt` (Fern dropped it: too big for context, little use), writing `llms.txt` into the repo, MDX, hosting the docs anywhere
**Done when:** an agent with only `curl` reads `/llms.txt`, follows a link and gets the right doc as markdown without its human-only parts, and `vibedoc_read_doc` on a wrong path suggests the right one

## Scenarios
### S1: Index for any agent
- WHEN an agent fetches `/llms.txt`
- THEN it gets the project title, every doc section with links to `/md/<path>` and descriptions, the capability specs and the open epics, and no `llms-full.txt` exists
### S2: Doc as markdown
- WHEN an agent requests `/md/docs/architecture/HLD.md` (or the doc URL with `Accept: text/markdown`)
- THEN it gets the file as `text/markdown`, with agent-only notes shown and human-only blocks removed
### S3: Wrong path
- WHEN an agent asks `/md/` or `vibedoc_read_doc` for a doc that doesn't exist
- THEN the answer names up to 5 similar docs instead of a bare error, and paths outside the project or in dot-folders are refused
### S4: Page actions
- WHEN the user opens ⋯ on a doc and picks Copy page or Ask agent about this doc
- THEN the clipboard holds the agent view of the doc, or a chat starts that reads that doc
### S5: Context header
- WHEN an agent calls `vibedoc_read_doc`
- THEN the reply starts with one line giving path, priority, last edit and inbound link count, and the line is gone after `docs.agentHeader: false`
