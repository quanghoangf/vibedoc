# Contributing to VibeDoc

Thanks for your interest! This guide covers everything you need to contribute.

---

## Development setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-fork>/vibedoc.git
cd vibedoc

# 2. Install dependencies (pnpm required)
pnpm install

# 3. Point at a test project and start the dev server
VIBEDOC_ROOT=/path/to/any-project pnpm dev
# → http://localhost:3000
```

> **Note:** `VIBEDOC_ROOT` defaults to `process.cwd()` if not set, so you can point at any directory that has `docs/`, `plans/tasks/`, or `memory/MEMORY.md`. The project reads whatever it finds — nothing is required.

---

## Architecture rules (non-negotiables)

Read [`CLAUDE.md`](./CLAUDE.md) for the full picture. The short version:

| Rule | Why |
|------|-----|
| Only `src/lib/core.ts` may import `fs` | Single source of truth for all file I/O |
| No `localStorage` | SSR/client mismatch |
| Tailwind CSS only — no CSS-in-JS | Consistency with existing styles |
| No database | File system is the source of truth |
| Call `emitUpdate()` after every mutation in an API route | Keeps the browser in sync via SSE |
| `/api/mcp` is hand-rolled JSON-RPC | The MCP SDK stdio transport doesn't work in Next.js API routes |

---

## Adding an MCP tool

1. Add a tool definition to the `TOOLS` array in `src/app/api/mcp/route.ts`
2. Add a `case` in `handleTool()` that calls a function from `src/lib/core.ts`
3. If the tool mutates state, call `emitUpdate()` after the mutation
4. Add the new core function to `src/lib/core.ts` (all file I/O lives there)
5. Update the tool table in `README.md`

---

## Commit convention

VibeDoc uses [Conventional Commits](https://www.conventionalcommits.org/). This drives automated versioning and CHANGELOG generation via semantic-release.

```
feat: add drag-and-drop kanban
fix: race condition in SSE reconnect
chore: update dependencies
docs: improve MCP tool descriptions
refactor: extract port-detection into helper
```

Breaking changes: add `!` after the type (`feat!: rename vibedoc_write_doc`)

---

## Branch naming

```
feat/<description>     # new features
fix/<description>      # bug fixes
chore/<description>    # tooling, deps, docs
```

---

## Submitting a PR

1. Fork the repo, create a branch from `main`
2. Make your changes — keep commits focused and conventional
3. Run `pnpm typecheck` and `pnpm build` — both must pass
4. Open a PR against `main` and fill out the PR template
5. CI will run lint + build automatically; merge is blocked until it passes

---

## Questions?

Open a [Discussion](https://github.com/quanghoangf/vibedoc/discussions) — not an issue.
