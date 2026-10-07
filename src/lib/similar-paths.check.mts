// Self-check for src/lib/similar-paths.ts: `node src/lib/similar-paths.check.mts`
import assert from "node:assert/strict"
import { similarPaths } from "./similar-paths.ts"
import { tokenize } from "./recall.ts"

const paths = [
  "docs/architecture/01-overview/DOMAIN_MAP.md",
  "docs/architecture/02-high-level-design/HLD.md",
  "docs/architecture-overview.md",
  "docs/guides/setup.md",
  "docs/guides/deploy.md",
  "docs/specs/memory.md",
  "memory/MEMORY.md",
  "README.md",
]

// a typo still finds the doc, first
assert.equal(similarPaths("docs/archtecture-overview.md", paths, tokenize)[0], "docs/architecture-overview.md")
// basename beats folder; shorter path wins a tie
assert.deepEqual(similarPaths("memory", paths, tokenize).slice(0, 2), ["memory/MEMORY.md", "docs/specs/memory.md"])
// folder-only hits still count, below basename hits
assert.deepEqual(similarPaths("guides/install.md", paths, tokenize), ["docs/guides/setup.md", "docs/guides/deploy.md"])
// at most n
assert.equal(similarPaths("docs", paths, tokenize, 5).length, 5)
assert.equal(similarPaths("architecture", paths, tokenize, 2).length, 2)
// nothing in common
assert.deepEqual(similarPaths("zzz-qqq", paths, tokenize), [])
assert.deepEqual(similarPaths("", paths, tokenize), [])

console.log("similar-paths.check: ok")
