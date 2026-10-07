---
title: Docs check in CI
description: Fail a pull request that breaks your docs with `vibedoc check`.
---

`vibedoc check` runs the same docs lint as the lint line on /docs and the `vibedoc_check_docs` MCP tool. It does not start VibeDoc, so it works in CI on a plain clone.

```sh
npx vibedoc check            # text report, grouped by file
npx vibedoc check --json     # the same report as JSON
npx vibedoc check --root docs-site   # check another folder (default: the current folder)
```

## What it checks

Every `.md` file in the folder, except `node_modules`, `.git` and `.next`.

| Level | Rule | Meaning |
|---|---|---|
| error | `broken-link` | A Markdown link or wikilink points at a file that doesn't exist |
| error | `bad-frontmatter` | The YAML frontmatter can't be parsed |
| error | `spec-structure` / `spec-changes` | A capability spec or an epic's `## Spec changes` can't be read |
| warn | `stale-path` | A backticked path names a missing file |
| warn | `no-h1` / `empty-doc` / `orphan-doc` | No title, no content, or nothing in the repo links to a doc under `docs/` |

## Exit codes

| Code | When |
|---|---|
| 0 | No errors. Warnings are printed but don't fail the check. |
| 1 | At least one error. |
| 2 | A wrong argument, or `--root` is not a folder. |

## GitHub Actions

Save this as `.github/workflows/docs-check.yml`. A pull request that breaks a doc link fails the job, and passes again once the link is fixed.

```yaml
name: Docs check
on:
  pull_request:
  push:
    branches: [main]

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx -y vibedoc check
```

`npx` downloads the VibeDoc package on every run. To pin a version, use `npx -y vibedoc@<version> check`. The job reads the files only: it never writes to the repo.
