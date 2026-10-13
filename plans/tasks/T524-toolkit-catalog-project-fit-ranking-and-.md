# T524: Toolkit catalog, project-fit ranking and installed detection
**Status:** 👀 Review
**Phase:** R098 — Agent toolkit setup
**Size:** M
**Depends on:** —
**Covers:** S1, S3
**Owner:** ai:claude-code
**Due:** 2026-10-16
**Started:** 2026-10-13

## Goal
VibeDoc knows its vetted plugin catalog, ranks it for the open project (best fit first, each with a one-line reason), and knows which items Claude Code already has. Exposed as `GET /api/toolkit`, with no UI yet.

## Context
- Epic: `plans/roadmap/R098-agent-toolkit-setup.md`. The `## Catalog` table there is the source list (8 items).
- Spec change built here: **agent-toolkit → Suggested toolkit** ("plugins matching the project's contents come first").
- Decisions from the breakdown:
  - The catalog is a typed TS module, `src/lib/toolkit-catalog.ts`, not JSON. Each item has: `id`, `plugin` (e.g. `frontend-design`), `marketplace` (name + repo for `marketplace add`), `reason` (en + vi), `fit` (signal ids), `order` (tie-break).
  - webapp-testing ships as the **bundle** `example-skills` from `anthropics/skills`. The catalog item is "Anthropic example skills", and its reason names webapp-testing.
  - Installed detection reuses T252's `pluginList(root)` (`claude plugin list --json`) and the rule in `pluginInstalled` (`src/lib/agent-connect.ts`): enabled, and user scope or `projectPath === root`. Generalize it to any `<plugin>@<marketplace>` instead of copying it.
- Fit signals (pure functions over a file listing / the frontend detection):
  - `web-frontend`: the same detection as `vibedoc_get_frontend` (T138)
  - `git`: `.git` exists
  - `server`: `src/app/api/`, `server/`, `api/`, or an express/fastify/hono/koa dependency
  - `lsp-ts` / `lsp-py` / `lsp-go`: `tsconfig.json` / `pyproject.toml` or `requirements.txt` / `go.mod`. Only the matching LSP item is listed; the others are hidden, not ranked low.
- Ranking: items that match a signal come first (by `order`), then the always-fit items, and each matched item says which signal matched (for the UI).

## Scope
- [ ] `src/lib/toolkit-catalog.ts` with the 8 items. Check the plugin ids and marketplace repos against the real CLI (`claude plugin marketplace add …` + `claude plugin install <id>@<mkt>` on a scratch machine) and note the checked Claude Code version in a comment.
- [ ] Pure `rankToolkit(catalog, signals)` and `detectSignals(root)` in `src/lib/toolkit.ts`; installed state merged from `pluginList`
- [ ] `GET /api/toolkit` → `{ items: [{ id, title, reason, matched?, installed, commands: string[] }], cli: { available, reason? } }`. `commands` are the exact commands for the copy fallback.
- [ ] Unit check `src/lib/toolkit.check.mts`: catalog shape (unique ids, en + vi reason, valid marketplace), web-frontend ranks frontend-design + example-skills first, the TS project shows only typescript-lsp, an installed plugin is `installed: true`, a disabled plugin or one installed for another project is not

**Out of scope:** any UI (T2), installing (T2), the chat tool (T3).

## Files
- `src/lib/toolkit-catalog.ts`: new
- `src/lib/toolkit.ts`: new (signals, ranking, installed merge)
- `src/lib/toolkit.check.mts`: new
- `src/lib/agent-connect.ts`: generalize `pluginInstalled` to take the plugin id
- `src/app/api/toolkit/route.ts`: new, GET

## Implementation notes
- Process calls stay in `src/lib/claude-cli.ts` (T251 rule: never in core.ts). Signals read files via the existing core helpers.
- With no `claude` on PATH, `cli.available: false`; items are still listed, all not installed.

## Acceptance criteria
- [ ] On this repo (Next.js, TS, git) `GET /api/toolkit` lists frontend-design and example-skills first, includes typescript-lsp, and omits pyright-lsp / gopls
- [ ] On a bare folder only always-fit items appear, and no `matched` is set
- [ ] Each item has a one-line reason in en and vi
- [ ] An item installed in Claude Code (stub `plugin list --json`) is `installed: true`
- [ ] `toolkit.check.mts` passes

## Verify
```bash
node src/lib/toolkit.check.mts
node src/lib/agent-connect.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH PORT=3081 pnpm dev:next &
curl -s localhost:3081/api/toolkit | jq '.items[] | {id, matched, installed}'
```

## Manual tests
_2026-10-13 — ai_
### Steps
- [ ] Open http://localhost:3000/api/toolkit on this repo → frontend-design and example-skills come first, typescript-lsp is listed, pyright-lsp and gopls-lsp are not
- [ ] Compare each item's `installed` with `claude plugin list --json` → enabled user-scope plugins (or ones enabled for this project) are true, disabled ones (e.g. feature-dev if disabled) are false
- [ ] Copy one item's two `commands` into a terminal on a machine without that plugin → the plugin installs
- [ ] Open /api/toolkit?root=<an empty folder> → only feature-dev and superpowers, neither has `matched`
### Regression risk
- [ ] Settings → Connect agent → the skills step still shows ✓ when the vibedoc plugin is installed
