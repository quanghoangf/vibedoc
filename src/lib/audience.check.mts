// Self-check for src/lib/audience.ts: `node src/lib/audience.check.mts`
import assert from "node:assert/strict"
import { formatAgentHeader, forAgent } from "./audience.ts"

// single-line agent-only: unwrapped, inline too
assert.equal(forAgent("a\n<!-- agent-only Use pnpm. -->\nb"), "a\nUse pnpm.\nb")
assert.equal(forAgent("See <!-- agent-only core.ts --> here"), "See core.ts here")

// multi-line agent-only
assert.equal(forAgent("a\n<!-- agent-only\nline 1\nline 2\n-->\nb"), "a\nline 1\nline 2\nb")

// human-only removed with its markers
assert.equal(forAgent("a\n<!-- human-only:start -->\nclick here\n<!-- human-only:end -->\nb"), "a\nb")
// inline on one line
assert.equal(forAgent("x <!-- human-only:start -->hidden<!-- human-only:end --> y"), "x  y")

// two adjacent blocks
assert.equal(
  forAgent("<!-- human-only:start -->\nh1\n<!-- human-only:end -->\n<!-- agent-only n1 -->\n<!-- human-only:start -->\nh2\n<!-- human-only:end -->\nend"),
  "n1\nend",
)

// unclosed start drops to end of file
assert.equal(forAgent("keep\n<!-- human-only:start -->\ngone\nalso gone"), "keep")

// markers inside fences are text
const fenced = "```md\n<!-- human-only:start -->\nx\n<!-- human-only:end -->\n<!-- agent-only y -->\n```"
assert.equal(forAgent(fenced), fenced)
assert.equal(forAgent("~~~\n<!-- agent-only y -->\n~~~"), "~~~\n<!-- agent-only y -->\n~~~")

// a fence inside a human-only block doesn't end it early
assert.equal(forAgent("<!-- human-only:start -->\n```\n<!-- human-only:end -->\n```\n<!-- human-only:end -->\nz"), "z")

// plain docs and ordinary comments untouched
assert.equal(forAgent("# T\n\n<!-- note -->\ntext\n"), "# T\n\n<!-- note -->\ntext\n")

// context header
assert.equal(
  formatAgentHeader({ path: "docs/x.md", priority: "P1", lastEdit: { actor: "ai", at: "2026-10-07T09:00:00.000Z" }, inbound: 3 }),
  "> docs/x.md · P1 · edited 2026-10-07 by ai · 3 inbound links · propose edits with vibedoc_propose_edit",
)
assert.equal(formatAgentHeader({ path: "a.md", inbound: 1 }), "> a.md · 1 inbound link · propose edits with vibedoc_propose_edit")
assert.equal(formatAgentHeader({ path: "a.md", priority: null, lastEdit: null }), "> a.md · propose edits with vibedoc_propose_edit")
assert.equal(formatAgentHeader({ path: "a.md", inbound: 0 }), "> a.md · 0 inbound links · propose edits with vibedoc_propose_edit")

console.log("audience.check: ok")
