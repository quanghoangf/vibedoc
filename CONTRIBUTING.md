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

## Releasing

A push to `main` releases. `.github/workflows/release.yml` runs semantic-release, which reads the commits since the last tag:

| Commits since the last tag | Release |
|---|---|
| only `chore` / `docs` / `test` / `refactor` | none |
| a `fix` | patch (1.24.0 → 1.24.1) |
| a `feat` | minor (1.24.0 → 1.25.0) |
| a `!` after the type, or `BREAKING CHANGE:` in a body | major |

When a release happens, in order:

1. **npm** — the `vibedoc` package (its `prepublishOnly` builds `.next`, the Playwright kit and the `vibedoc check` bundle), the tag `v<version>`, the GitHub release with its notes, and `CHANGELOG.md` + the bumped `package.json` / `plugin/.claude-plugin/plugin.json` in a `[skip ci]` commit. Don't edit CHANGELOG.md by hand.
2. **Site** — `site.yml` rebuilds the site, so the changelog page and the docs show the release.
3. **Desktop app** — `desktop.yml` builds the installers on macOS, Windows and Linux runners and attaches them to the GitHub release: `VibeDoc-mac-arm64.dmg`, `VibeDoc-mac-x64.dmg`, the macOS `.zip`s, `VibeDoc-Setup.exe`, `VibeDoc-x86_64.AppImage` and the `latest*.yml` update feeds. The installed apps see the new version from those feeds. To rebuild one version: Actions → Desktop → Run workflow with that version.
4. **Homebrew** — the formula in `quanghoangf/homebrew-vibedoc`.

Repository secrets:

| Secret | For | Without it |
|---|---|---|
| `NPM_TOKEN` | publishing to npm | no release |
| `HOMEBREW_TAP_TOKEN` | pushing the Homebrew formula | the tap step is skipped |
| `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | signing and notarizing the macOS app | unsigned: users right-click → Open the first time, and the app can't install its own updates on macOS (it links to the release instead) |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | signing the Windows installer | unsigned: SmartScreen asks once (More info → Run anyway) |

Before pushing a release, locally:

```bash
pnpm lint && pnpm build                       # the app
pnpm --dir site test                          # the site
node e2e/desktop-app.mjs                      # the desktop app (after pnpm --dir desktop install)
pnpm --dir desktop run dist                   # optional: this OS's installer in desktop/dist/
```

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
