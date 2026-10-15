// Self-check for src/lib/doc-scope.ts: `node src/lib/doc-scope.check.mts`
import assert from "node:assert/strict"
import { DEPENDENCY_DIRS, fuzzyDocMatch, isHiddenPath, isSkippedPath, parseGitPaths, SKIP_DIRS, SKIP_IGNORE, splitMarkdown } from "./doc-scope.ts"

// skipped: a dependency / build folder anywhere on the path, never the file name
assert.equal(isSkippedPath("target/debug/build/x/README.md"), true)
assert.equal(isSkippedPath("crates/net/target/doc/a.md"), true)
assert.equal(isSkippedPath("packages/ui/node_modules/react/README.md"), true)
assert.equal(isSkippedPath("docs/build.md"), false)
assert.equal(isSkippedPath("docs/guides/setup.md"), false)
assert.equal(isSkippedPath("README.md"), false)

// hidden: a dot folder anywhere on the path
assert.equal(isHiddenPath(".claude/skills/s/SKILL.md"), true)
assert.equal(isHiddenPath("docs/.drafts/a.md"), true)
assert.equal(isHiddenPath("docs/a.md"), false)
assert.equal(isHiddenPath(".notes.md"), false)

// split: sorted, unique, POSIX, .md only, skipped dropped, dot folders to hidden
assert.deepEqual(
  splitMarkdown(["docs/b.md", "./README.md", "docs\\a.md", "docs/b.md", "src/app.ts", "target/x.md", ".claude/s/SKILL.md", ".venv/lib/x.md", "NOTES.MD"]),
  { docs: ["NOTES.MD", "README.md", "docs/a.md", "docs/b.md"], hidden: [".claude/s/SKILL.md"] },
)

// a git listing skips dependencies only: a tracked build/ folder of docs stays, a vendored module never shows
assert.deepEqual(
  splitMarkdown(["build/how-we-build.md", "vendor/github.com/x/README.md", "web/node_modules/a/README.md"], DEPENDENCY_DIRS),
  { docs: ["build/how-we-build.md"], hidden: [] },
)
assert.equal(isSkippedPath("build/how-we-build.md", DEPENDENCY_DIRS), false)
assert.equal(isSkippedPath("build/how-we-build.md"), true)

// git output: NUL-separated, deleted files subtracted, names with spaces or accents kept as written
assert.deepEqual(parseGitPaths("README.md\0docs/a b.md\0docs/gone.md\0docs/tài liệu.md\0", "docs/gone.md\0"), ["README.md", "docs/a b.md", "docs/tài liệu.md"])
assert.deepEqual(parseGitPaths(""), [])

// glob ignore: one brace pattern over every skipped folder, ending in /** so glob prunes it
assert.equal(SKIP_IGNORE.length, 1)
assert.ok(SKIP_IGNORE[0].startsWith("**/{") && SKIP_IGNORE[0].endsWith("}/**"))
for (const d of ["node_modules", "target", ".git", ".next", ".venv"]) assert.ok(SKIP_DIRS.includes(d), d)

// fuzzy: exact name, then prefix, then substring; case-insensitive; * never crosses /; shallowest first
const paths = ["docs/architecture/HLD.md", "docs/guides/setup-mac.md", "docs/guides/setup.md", "plans/tasks/T001-setup-ci.md", "a/b/c/HLD.md", "docs/user-service/API.md"]
assert.equal(fuzzyDocMatch(paths, "hld"), "docs/architecture/HLD.md")
assert.equal(fuzzyDocMatch(paths, "setup"), "docs/guides/setup.md")
assert.equal(fuzzyDocMatch(paths, "setup-m"), "docs/guides/setup-mac.md")
assert.equal(fuzzyDocMatch(paths, "T001"), "plans/tasks/T001-setup-ci.md")
assert.equal(fuzzyDocMatch(paths, "ci"), "plans/tasks/T001-setup-ci.md")
assert.equal(fuzzyDocMatch(paths, "user-service/API"), "docs/user-service/API.md")
assert.equal(fuzzyDocMatch(paths, "guides"), null) // a folder name alone: * cannot cross into the file name
assert.equal(fuzzyDocMatch(paths, "nope"), null)
assert.equal(fuzzyDocMatch(paths, ""), null)

console.log("doc-scope.check: ok")
