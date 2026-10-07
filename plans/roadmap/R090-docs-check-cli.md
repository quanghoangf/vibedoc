# R090: Docs check in CI
**Parent:** R004
**Status:** done
**Order:** 110
**Tasks:** T420, T421

Teams can stop a PR that breaks the docs: `vibedoc check` runs R088's lint without starting the app and exits non-zero on errors. Adapted from Fern's `fern check` and its sample workflow.

**In scope:** `vibedoc check [--json]` subcommand in `bin/vibedoc.mjs`; a prebuilt lint bundle in `dist/` (the bin ships unbuilt, core is TypeScript); a sample GitHub Actions workflow in the site docs
**Out of scope:** starting Next in CI, fixing issues
**Done when:** a repo with a broken doc link fails the sample workflow and passes once the link is fixed

## Scenarios
### S1: Broken link fails the check
- WHEN `npx vibedoc check` runs in a repo with a broken doc link, with no VibeDoc server running
- THEN it prints the issue as `formatLint` text (path, line, rule) and exits 1
### S2: Fixed docs pass
- WHEN the link is fixed and only warnings are left
- THEN it prints the summary and exits 0
### S3: JSON output
- WHEN it runs with `--json` (optionally `--root <dir>`)
- THEN stdout is the `DocLint` JSON and the exit code follows the same rule
### S4: Sample workflow
- WHEN a team copies the sample GitHub Actions workflow from the site docs
- THEN a PR that breaks a doc link fails the job, and passes once the link is fixed
