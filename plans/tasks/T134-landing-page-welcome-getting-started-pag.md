# T134: Landing page /welcome + getting-started page
**Status:** ✅ Done
**Phase:** R042 — Demo & docs site
**Size:** M
**Depends on:** T132
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
Newcomers get a landing page that explains VibeDoc in a few seconds and links to the live demo, and a getting-started page that takes them from install to an agent moving their first task.

## Context
- Epic: `plans/roadmap/R042-demo-and-docs-site.md`
- Decided: the site lives as routes in this app, not as a separate static site. `/` stays the board (the app's main shell), so the landing page is at **`/welcome`** and getting started is at **`/getting-started`**. Both work in every mode.
- Out of the epic: demo GIF/video (dropped from scope).
- Rules: Tailwind only, dark theme, no component library.

## Scope
- [ ] `/welcome`: hero (one-line pitch), 3–4 feature blocks (board + MCP tools, roadmap, memory, agent chat), the `npx vibedoc` install command with a copy button, and CTAs "Open live demo" (→ `/`, `/roadmap`), "Getting started" and GitHub
- [ ] `docs/getting-started.md`: install, point at a project, connect Claude Code / Cursor to `/api/mcp`, first session (read memory → next task → done). Reuse content from README and `docs/architecture/mcp-tools.md`; don't duplicate the full tool reference, link to it
- [ ] `/getting-started` renders that markdown with the existing markdown renderer
- [ ] Demo banner (T1) links to `/welcome`

**Out of scope:** README/npm links and e2e (T4), SEO and analytics.

## Files
- `src/app/(app)/welcome/page.tsx` (or outside the `(app)` group if the app chrome shouldn't wrap it): new
- `src/app/(app)/getting-started/page.tsx`: new; reads the doc via an API route (no `fs` outside `core.ts`)
- `docs/getting-started.md`: new

## Implementation notes
- Check which group layout fits: a landing page usually wants no app sidebar.
- Loading the markdown: reuse `/api/docs` read. The doc must come from VibeDoc's own repo even when `VIBEDOC_ROOT` points at the example project. Either bundle it at build time (import as a string) or add a core helper that reads from the package dir.

## Acceptance criteria
- [ ] `/welcome` renders in normal and demo mode; all CTAs resolve
- [ ] `/getting-started` renders the doc, including in demo mode with `VIBEDOC_ROOT=examples/demo-project`
- [ ] Following getting-started on a clean project gets an agent to list tasks via MCP
- [ ] Lighthouse a11y ≥ 90 on `/welcome`

## Verify
```bash
npm run lint && npm run build
VIBEDOC_DEMO=1 VIBEDOC_ROOT=examples/demo-project npm run dev   # open /welcome, /getting-started
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Run with `VIBEDOC_DEMO=1 VIBEDOC_ROOT=examples/demo-project` and open `/board`. In the header, click the "Live demo, read-only" banner. You land on `/welcome` with no sidebar and no app header.
- [ ] On `/welcome`, click the copy button beside `npx vibedoc`. The icon turns into a check for about 2 seconds, and pasting gives `npx vibedoc`.
- [ ] On `/welcome`, click "Open live demo", then "See the roadmap", then "Getting started". They open /board, /roadmap and /getting-started. "GitHub" opens github.com/quanghoangf/vibedoc.
- [ ] Open `/getting-started` while VIBEDOC_ROOT points at the example project. You see VibeDoc's own guide (Install, Point it at a project, Connect your agent, First session), not a doc from the demo project. The header title reads "Getting started". Step 1 says Node.js 20.9 or newer and that `npx vibedoc` opens the setup wizard.
- [ ] On `/getting-started`, click the "MCP tools reference" and "README" links. Both open the pages on GitHub, not a 404 inside the app.
- [ ] Follow the guide on an empty folder with Node 20.9+: `npx vibedoc` opens `/setup`; click Board in the sidebar to skip it. Add T001 as the guide shows, then run `claude mcp add --transport http vibedoc http://localhost:<port>/api/mcp`. Ask the agent to list the VibeDoc tasks, and T001 comes back.
### Regression risk
- [ ] Outside demo mode, the header has no demo banner and `/docs` still lists and opens the project's own docs. `/api/docs` GET without `?guide=` behaves the same as before.
- [ ] In demo mode, `/chat`, `/settings` and `/setup` still show the "Not available in the read-only demo" note, and `/getting-started` is not blocked.
