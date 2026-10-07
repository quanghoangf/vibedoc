// Self-check for src/lib/llms-txt.ts: `node src/lib/llms-txt.check.mts`
import assert from "node:assert/strict"
import { formatLlmsTxt, MAX_INLINE_DOCS } from "./llms-txt.ts"

const base = {
  title: "listly",
  origin: "http://h",
  docs: [
    { path: "README.md", section: "root", description: "What it is" },
    { path: "docs/architecture/01-overview/DOMAIN_MAP.md", section: "overview", description: "Bounded\ncontexts" },
    { path: "docs/guides/setup.md", section: "other" },
  ],
  specs: [{ path: "docs/specs/memory.md", title: "Memory", purpose: "What agents remember" }],
  epics: [{ id: "R002", title: "Billing", status: "in-progress", path: "plans/roadmap/R002-billing.md" }],
}

const full = formatLlmsTxt(base)
assert.match(full, /^# listly\n\n> /)
assert.match(full, /## root\n- \[README\.md\]\(http:\/\/h\/md\/README\.md\): What it is\n/)
// descriptions on one line; missing description → no colon
assert.match(full, /DOMAIN_MAP\.md\): Bounded contexts\n/)
assert.match(full, /- \[docs\/guides\/setup\.md\]\(http:\/\/h\/md\/docs\/guides\/setup\.md\)\n/)
assert.match(full, /## Capability specs\n- \[Memory\]\(http:\/\/h\/md\/docs\/specs\/memory\.md\): What agents remember/)
assert.match(full, /## Open epics\n- \[R002: Billing\]\(http:\/\/h\/md\/plans\/roadmap\/R002-billing\.md\): in-progress\n$/)
assert.doesNotMatch(full, /llms-full/)

// ?root= carried on every link
const withRoot = formatLlmsTxt({ ...base, query: "?root=%2Ftmp%2Fx" })
assert.match(withRoot, /\/md\/README\.md\?root=%2Ftmp%2Fx\)/)

// one section
const one = formatLlmsTxt({ ...base, section: "overview" })
assert.match(one, /## overview\n- \[docs\/architecture/)
assert.doesNotMatch(one, /README|Capability specs|Open epics/)
// unknown section → the section names
const unknown = formatLlmsTxt({ ...base, section: "nope", query: "?root=r" })
assert.match(unknown, /No section "nope"\. Sections:\n- \[root\]\(http:\/\/h\/llms\.txt\?section=root&root=r\)/)

// a big project lists sections one level deep
const many = Array.from({ length: MAX_INLINE_DOCS + 1 }, (_, i) => ({ path: `docs/d${i}.md`, section: i % 2 ? "other" : "overview" }))
const big = formatLlmsTxt({ ...base, docs: many })
assert.match(big, /## Doc sections\n- \[overview\]\(http:\/\/h\/llms\.txt\?section=overview\): 76 docs\n- \[other\]/)
assert.doesNotMatch(big, /d10\.md/)
assert.match(big, /## Capability specs/)

// empty project: title only, no empty sections
assert.equal(formatLlmsTxt({ ...base, docs: [], specs: [], epics: [] }).split("\n").filter((l) => l.startsWith("## ")).length, 0)

console.log("llms-txt.check: ok")
