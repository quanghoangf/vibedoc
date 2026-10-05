# T210: Docs site with Starlight and a generated MCP tool reference
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-05
**Phase:** R074 — Docs site
**Size:** L (half a day)
**Depends on:** T209

## Goal
A new user goes from the landing page to a working setup using only the docs, and every MCP tool has its own page that cannot drift from the code.

## Context
- Epic: `plans/roadmap/R074-docs-site.md`.
- Decisions: Starlight (`@astrojs/starlight`) inside `site/`, served at `/vibedoc/docs/` next to the landing page, with Pagefind search. One page per MCP tool, generated at build time from the tool definitions.
- The tool list lives in `TOOLS` in `src/app/api/mcp/route.ts`. Move it (and `withProjectStatuses`' input) to pure `src/lib/mcp-tools.ts` so the site can import it; route.ts imports it back. Pure libs never import values from each other.
- Content comes from what exists: `docs/getting-started.md`, README sections, MEMORY.md conventions, the plugin skills. `docs/api-reference.md` is an unused template.

## Scope
- [ ] Starlight in the site package; landing page unchanged at `/vibedoc/`; Docs links (header, footer, `DOCS` in `links.ts`) point at `/vibedoc/docs/`
- [ ] Pages: Getting started (install per channel, connect, first session), Concepts (tasks, roadmap, memory, specs, evidence), Skills (/vibedoc:roadmap · breakdown · work · next), Troubleshooting
- [ ] `src/lib/mcp-tools.ts` with `TOOLS`; `/docs/tools/` index + one page per tool (description, parameters table with type / required / description)
- [ ] Docs styled with the landing page's tokens (violet accent, Inter / JetBrains Mono), light and dark

**Out of scope:** versioned docs, translations, a blog, the AI install prompt (T211).

## Files
- `src/lib/mcp-tools.ts` — new; `src/app/api/mcp/route.ts` imports it
- `site/astro.config.mjs`, `site/package.json` — Starlight
- `site/src/content/docs/docs/**` — pages; `site/src/pages/docs/tools/[name].astro` — generated pages
- `site/src/data/links.ts`, `site/e2e/docs.spec.ts`

## Acceptance criteria
- [ ] `/vibedoc/docs/` has a sidebar, search, and the four guide pages
- [ ] `/vibedoc/docs/tools/` lists all 45 tools; each tool page shows its parameters
- [ ] VibeDoc's MCP `tools/list` returns the same tools as before (build + lint pass)
- [ ] Landing "Docs" link opens the docs site; site tests pass

## Verify
```bash
pnpm build && pnpm lint
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
### Steps
- [x] 🤖 Open the landing page and click Docs in the header → Getting started opens at /vibedoc/docs/
- [x] 🤖 The docs sidebar lists Getting started, Skills, Troubleshooting and the five concept pages
- [x] 🤖 Click Search and type vibedoc_next_task → the tool's page is in the results
- [x] 🤖 Open MCP tools → All tools → every tool is listed, and each has its own page with a Parameters section
- [x] 🤖 Open vibedoc_update_task → taskId is listed as required
- [ ] Read Getting started end to end on a fresh project → you get VibeDoc running and connected with nothing else open
- [ ] Toggle light / dark with the theme picker → both read well, violet accent, Geist font
### Regression risk
- [ ] An agent connected to /api/mcp still gets all 45 tools from tools/list (the definitions moved to `src/lib/mcp-tools.ts`)
