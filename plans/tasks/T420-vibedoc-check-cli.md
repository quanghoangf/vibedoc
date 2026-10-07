# T420: `vibedoc check` CLI over a prebuilt lint bundle
**Status:** 📋 Todo
**Phase:** R090 — Docs check in CI
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1, S2, S3

## Goal
`vibedoc check [--json] [--root <dir>]` runs R088's doc lint from a plain clone, without starting Next, and exits 1 on any error-level issue. This is what a CI job calls.

## Context
- Epic: `plans/roadmap/R090-docs-check-cli.md`
- Decision: the bin ships unbuilt JS and the lint is TypeScript with extensionless imports, so `tsc` (nodenext needs `.js` specifiers) and Node type stripping don't work. A small entry `src/cli/check.ts` is bundled with **esbuild** (new devDependency; not installed before) into `dist/cli/check.mjs` (`--bundle --platform=node --format=esm --packages=external`, so `glob` stays a runtime dependency). Built by `pnpm build:cli`, run from `prepublishOnly`; `dist/cli/` added to package.json `files`. `dist/` is gitignored.
- Decision: the project-level assembly in core's `getDocLint` (specs + spec-changes op by op + `lintDocs` + `summarizeLint`) moves into `src/lib/doc-lint-project.ts` (`lintProject(files, graph, file?)`), shared by core and the CLI, so CI and the app report the same issues. It imports values from other libs, so no `.check.mts` imports it directly (pure libs rule).
- Decision: the CLI is outside the Next app, so it has its own tiny file reader (glob `**/*.md` with core's ignores + the hidden dot-folder list for `buildDocGraph`). CLAUDE.md's "fs only in core.ts" is about the app; core.ts can't be bundled into the CLI (Next-only imports, caches, activity log).
- `bin/vibedoc.mjs` dispatches `check` before any port/server logic: `import('../dist/cli/check.mjs')`; a missing bundle prints "run pnpm build:cli".

## Scope
- [ ] `src/lib/doc-lint-project.ts`: `lintProject(files, graph, file?) → DocLint`; core `getDocLint` calls it (same output as before).
- [ ] `src/cli/check.ts`: args `--json`, `--root <dir>` (default cwd), reads .md files, builds the graph (`docNode`/`extractLinks`/`buildDocGraph`), prints `formatLint` or JSON, exit 1 on errors, 2 on bad args.
- [ ] esbuild devDependency, `build:cli` script, `prepublishOnly` runs it, `dist/cli/` in `files`.
- [ ] `bin/vibedoc.mjs` `check` subcommand.
- [ ] `bin/check.check.mts`: builds a temp fixture with a broken link → exit 1 and the issue printed; `--json` parses with `errors ≥ 1`; fix the link → exit 0.

**Out of scope:** the sample workflow and site docs (T421), starting Next, auto-fixing.

## Files
- `src/lib/doc-lint-project.ts` — new
- `src/lib/core.ts` — `getDocLint` delegates
- `src/cli/check.ts` — new
- `bin/vibedoc.mjs` — `check` dispatch
- `bin/check.check.mts` — new
- `package.json` — esbuild, `build:cli`, `prepublishOnly`, `files`

## Acceptance criteria
- [ ] Broken link fixture: `node bin/vibedoc.mjs check --root <fixture>` prints the broken-link issue and exits 1, no server started.
- [ ] Fixed fixture: exit 0 with the summary line.
- [ ] `--json` prints valid `DocLint` JSON; same exit code rule.
- [ ] On this repo `vibedoc check` reports the same counts as `GET /api/docs/lint`.

## Verify
```bash
pnpm build:cli && node bin/check.check.mts
node bin/vibedoc.mjs check; echo exit=$?
pnpm lint && pnpm typecheck && pnpm build
```

## Manual tests
### Steps
- [ ] S1 — WHEN `npx vibedoc check` runs in a repo with a broken doc link, with no VibeDoc server running → THEN it prints the issue as `formatLint` text (path, line, rule) and exits 1
- [ ] S2 — WHEN the link is fixed and only warnings are left → THEN it prints the summary and exits 0
- [ ] S3 — WHEN it runs with `--json` (optionally `--root <dir>`) → THEN stdout is the `DocLint` JSON and the exit code follows the same rule
