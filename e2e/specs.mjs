// Browser + MCP check for R066 (Living capability specs), end to end on a fixture project. The epic's Done-when:
// a spec exists and an agent claiming a task in that area sees its requirements without being told where to look.
//   1. /docs → New document → "Capability spec" → docs/specs/board-views.md → the row shows the Capability spec chip.
//   2. /graph lists "Capability specs" in the kind filter and draws the file as a capability spec.
//   3. An epic with **Specs:** board-views + a task → vibedoc_get_task and vibedoc_next_task end with ## Related spec.
//   4. vibedoc_get_spec returns one requirement; vibedoc_list_specs counts it.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/specs.mjs
//
// Uses the real /api/mcp and routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const specPath = "docs/specs/board-views.md"

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

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

  // 1. Create a spec from the template; the list marks it
  await page.goto(`${BASE}/docs`)
  await page.getByRole("button", { name: "New document" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /^Capability spec/ }).click()
  await dialog.getByRole("textbox").fill(specPath)
  await dialog.getByRole("button", { name: "Create" }).click()
  await page.getByRole("button").and(page.getByTitle(specPath)).getByText("Capability spec").waitFor()
  assert.match(readFileSync(path.join(fx, specPath), "utf8"), /### Requirement: /)
  console.log("ok  New document → Capability spec → the row shows the chip")

  // 2. /graph knows the kind
  await page.goto(`${BASE}/graph`)
  const chip = page.getByRole("button", { name: /^Capability specs 1$/ })
  await chip.waitFor()
  assert.equal(await chip.getAttribute("aria-pressed"), "true")
  await page.getByRole("button", { name: /^Capability spec Capability name, 0 links/ }).waitFor()
  console.log("ok  /graph lists Capability specs and draws the file as one")

  // 3. An epic that declares the spec → its task gets the requirements
  writeFileSync(path.join(fx, specPath), [
    "# Board views", "", "## Purpose", "How the board shows tasks.", "",
    "### Requirement: Saved views", "The board SHALL keep named views.", "",
    "#### Scenario: Save a view", "- WHEN the user saves the filters", "- THEN the view is listed", "",
    "### Requirement: Table view", "The board SHALL offer a table.", "",
    "#### Scenario: Sort", "- WHEN the user clicks a column", "- THEN rows sort by it", "",
  ].join("\n"))
  assert.match(await mcp("vibedoc_update_roadmap_item", { id: "R002", specs: ["board-views"], tasks: ["T001"] }), /Updated/)
  assert.match(readFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "utf8"), /^\*\*Specs:\*\* board-views$/m)
  writeFileSync(path.join(fx, "plans/tasks/T001-polish.md"), "# T001: Polish the cards\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n\n## Goal\nNicer cards.\n")
  const task = await mcp("vibedoc_get_task", { taskId: "T001" })
  assert.match(task, /## Related spec\nBoard views · docs\/specs\/board-views\.md\n- Saved views\n- Table view\n/)
  const claim = await mcp("vibedoc_next_task", { epic: "R002", agent: "e2e" })
  assert.match(claim, /🔨 Claimed \*\*T001\*\*/)
  assert.match(claim, /## Related spec[\s\S]*- Saved views/)
  console.log("ok  get_task and next_task end with ## Related spec")

  // 4. The spec tools
  const one = await mcp("vibedoc_get_spec", { capability: "board-views", requirement: "table VIEW" })
  assert.match(one, /### Requirement: Table view/)
  assert.doesNotMatch(one, /Saved views/)
  assert.match(await mcp("vibedoc_list_specs", {}), /- board-views · Board views · 2 requirements · 2 scenarios/)
  console.log("ok  vibedoc_get_spec returns one requirement; vibedoc_list_specs counts it")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
