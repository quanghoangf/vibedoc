# R056: Doc link graph
**Parent:** R003
**Status:** planned
**Order:** 80
**Tasks:** T093, T094, T095, T096, T097, T098, T099, T100

People and agents can follow how docs link to each other. Readers click through to linked docs, see what links in and out, and browse the whole link map. Agents learn which related files to read next. Inspired by Obsidian's graph view and codegraph tools.

**In scope:** resolved links between all project .md files (relative `.md` links incl. `../`, `[[wikilinks]]`, backticked paths, task/epic/entry/ADR ids); clickable links in the doc preview; a Linked docs panel (links to / linked from / broken); hover preview of a linked doc; a `/graph` page with a force layout, kind filters, focus and search; a resolved "Related files" footer in `vibedoc_read_doc`; an mtime cache for the link scan
**Out of scope:** a local graph inside the doc panel; a new MCP tool that bundles a doc with its neighbours; links to code files; storing links or positions anywhere (links are derived from text, like R053)
**Done when:** opening a doc shows the docs it links to and the docs that link to it, each one click away; `/graph` shows every doc link in the repo and clicking a node opens it; `vibedoc_read_doc` ends with the resolved related files an agent should read next
