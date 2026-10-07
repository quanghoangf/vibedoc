// Browser + MCP check for R092 (doc upkeep agent), end to end on a fixture git repo. The epic's Done-when:
// finishing a task that renames a file flags the doc mentioning it, and Fix docs proposes the corrected path.
//   1. T001's commit renames src/a.ts → src/b.ts; docs/guide.md still names src/a.ts. T001 in review → no flag.
//   2. T001 done → vibedoc_check_docs lists `warn outdated-ref` on the doc (not on the task file naming the path).
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3192 pnpm dev   # then:
//   BASE=http://localhost:3192 PW_DIR=node_modules/.pnpm/playwright@<v>/node_modules/playwright node e2e/doc-upkeep.mjs
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { makeFixture } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3192"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (...args) => execFileSync("git", ["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", ...args], { cwd: fx, encoding: "utf8" })

writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"),
  "# R002: Epic\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001\n")
writeFileSync(path.join(fx, "plans/tasks/T001-rename.md"), [
  "# T001: Rename a to b", "**Status:** 👀 Review", "**Phase:** R002 — Epic", "",
  "## Files", "- `src/a.ts` → `src/b.ts`", "",
].join("\n"))
mkdirSync(path.join(fx, "src"), { recursive: true })
mkdirSync(path.join(fx, "docs"), { recursive: true })
writeFileSync(path.join(fx, "src/a.ts"), "export const a = 1\n")
const guide = "# Guide\n\n## Entry point\n\nThe app starts in `src/a.ts`.\n"
writeFileSync(path.join(fx, "docs/guide.md"), guide)
writeFileSync(path.join(fx, "docs/index.md"), "# Index\n\n- [Guide](guide.md)\n")
git("init", "-q")
git("add", "-A")
git("commit", "-q", "-m", "chore: init")
git("mv", "src/a.ts", "src/b.ts")
git("commit", "-q", "-m", "refactor: rename a to b (T001)")

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "claude-code/2.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

try {
  // 1. the renaming task isn't done yet → no flag
  assert.doesNotMatch(await mcp("vibedoc_check_docs", {}), /outdated-ref/)
  console.log("ok  a rename by a task that isn't done flags nothing")

  // 2. T001 done → the doc is flagged at the line naming the old path; the task file naming it is not
  await mcp("vibedoc_update_task", { taskId: "T001", status: "done" })
  const report = await mcp("vibedoc_check_docs", {})
  assert.match(report, /\*\*docs\/guide\.md\*\*\n {2}L5 warn outdated-ref: `src\/a\.ts` was renamed to `src\/b\.ts` by T001/)
  assert.equal(report.match(/outdated-ref/g)?.length, 1)
  const api = await (await fetch(`${BASE}/api/docs/lint${q}&path=docs/guide.md`)).json()
  assert.deepEqual(api.issues.find((i) => i.rule === "outdated-ref"), {
    path: "docs/guide.md", line: 5, level: "warn", rule: "outdated-ref", message: "`src/a.ts` was renamed to `src/b.ts` by T001",
    target: "src/a.ts", task: "T001", renamedTo: "src/b.ts", heading: "Entry point",
  })
  console.log("ok  S1: T001 done → vibedoc_check_docs flags docs/guide.md (outdated-ref, T001, src/a.ts → src/b.ts)")
} finally {
  rmSync(fx, { recursive: true, force: true })
}
