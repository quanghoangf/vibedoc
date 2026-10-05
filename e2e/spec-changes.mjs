// Browser + MCP check for R069 (Spec changes on epics), end to end on a fixture project. The epic's Done-when:
// finishing an epic that modifies one requirement produces a one-click diff, and accepting it updates the capability spec.
//   1. docs/specs/memory.md + a done epic R002 whose ## Spec changes MODIFY "Session budget" → /roadmap "need attention"
//      shows the spec-unmerged row, and vibedoc_get_roadmap says the same.
//   2. Sheet → Merge into capability spec → the diff shows only that requirement → Accept.
//   3. The spec file has the new text (everything else byte-for-byte), R002 has **Spec merged:**, the drift row is gone.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/spec-changes.mjs
//
// Uses the real /api/mcp and routes (only /api/projects and /api/chat are stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const specFile = path.join(fx, "docs/specs/memory.md")
const before = [
  "# Memory", "", "## Purpose", "What memory does.", "", "## Requirements", "",
  "### Requirement: Session budget", "Session start SHALL fit 2000 tokens.", "",
  "#### Scenario: Many entries", "- WHEN 200 entries", "- THEN it fits", "",
  "### Requirement: Recall", "It SHALL rank by keyword.", "",
].join("\n")
mkdirSync(path.dirname(specFile), { recursive: true })
writeFileSync(specFile, before)
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), [
  "# R002: Bigger budget", "**Parent:** R001", "**Status:** done", "**Order:** 10", "**Tasks:** —", "",
  "Room for more entries.", "", "## Spec changes", "### memory",
  "#### MODIFIED Requirement: Session budget", "Session start SHALL fit 3000 tokens.", "",
  "##### Scenario: Many entries", "- WHEN 300 entries", "- THEN it fits", "",
].join("\n"))

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

const unmerged = `R002 "Bigger budget" is done but its spec changes aren't merged into memory`
const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    // the app has no favicon; not this feature's concern
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. Unmerged spec changes are flagged
  await page.goto(`${BASE}/roadmap`)
  await page.getByText(/need attention$/).click()
  await page.getByRole("button", { name: unmerged }).waitFor()
  assert.ok((await mcp("vibedoc_get_roadmap", {})).includes(`- ${unmerged}`))
  console.log("ok  done epic with unmerged spec changes → need attention + vibedoc_get_roadmap")

  // 2. One-click diff: only the modified requirement changes
  await page.getByRole("button", { name: unmerged }).click()
  await page.getByRole("button", { name: "Merge into capability spec" }).click()
  const diff = page.getByRole("dialog").getByRole("region", { name: "docs/specs/memory.md" })
  await diff.getByText("+ Session start SHALL fit 3000 tokens.").waitFor()
  const changed = await diff.locator("div").filter({ hasText: /^[+−] / }).allInnerTexts()
  assert.deepEqual(changed.sort(), [
    "+ - WHEN 300 entries", "+ Session start SHALL fit 3000 tokens.",
    "− - WHEN 200 entries", "− Session start SHALL fit 2000 tokens.",
  ])
  await page.getByRole("dialog").getByRole("button", { name: "Accept" }).click()
  await page.getByText(/^Capability spec merged \d{4}-\d{2}-\d{2}$/).waitFor()
  console.log("ok  Merge → diff of only that requirement → Accept")

  // 3. The spec, the epic and the drift agree
  assert.equal(readFileSync(specFile, "utf8"), before.replace("2000 tokens", "3000 tokens").replace("200 entries", "300 entries"))
  assert.match(readFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "utf8"), /^\*\*Spec merged:\*\* \d{4}-\d{2}-\d{2}$/m)
  const roadmap = await mcp("vibedoc_get_roadmap", {})
  assert.ok(!roadmap.includes(unmerged) && !roadmap.includes("spec changes not merged"))
  assert.match(await mcp("vibedoc_get_spec", { capability: "memory", requirement: "Session budget" }), /3000 tokens[\s\S]*#### Scenario: Many entries\n- WHEN 300 entries/)
  console.log("ok  spec updated (rest byte-for-byte), Spec merged stamped, drift gone")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
