# R090: Docs check in CI
**Parent:** R004
**Status:** planned
**Order:** 110
**Tasks:** —

Teams can stop a PR that breaks the docs: `vibedoc check` runs R088's lint without starting the app and exits non-zero on errors. Adapted from Fern's `fern check` and its sample workflow.

**In scope:** `vibedoc check [--json]` subcommand in `bin/vibedoc.mjs`; a prebuilt lint bundle in `dist/` (the bin ships unbuilt, core is TypeScript); a sample GitHub Actions workflow in the site docs
**Out of scope:** starting Next in CI, fixing issues
**Done when:** a repo with a broken doc link fails the sample workflow and passes once the link is fixed
