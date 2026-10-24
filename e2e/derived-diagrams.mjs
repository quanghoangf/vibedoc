// Browser check for R097 (Diagrams from project data) on a fixture project:
//   S1/S4 (T520). a task with dependencies and dependents shows a diagram of both sides in its board panel and in its
//         doc (glyph + status class per node, the task itself the accent, a missing dependency dashed); click or Enter
//         on a node opens that task; a task with neither shows no diagram; a status change recolours a node live
//   S2/S4 (T521). an epic shows its tasks (dependency order) and scenarios, a dotted edge per covered scenario,
//         scenarios coloured passed / unproven / uncovered; a task node opens the task beside the pane, a scenario node
//         scrolls to and flashes its row; a task status change recolours the map live
//   S3 (T522). a doc's Linked docs panel opens with a link map: files linking to it above, files it links to below, a broken link dashed; clicking a file opens it in /docs
//   S5 (T523). vibedoc_get_task ends with ## Dependencies (both sides with statuses); vibedoc_get_roadmap { id } gives
//         an epic's tasks in dependency order with covers and scenario statuses; without id the reply is unchanged
// Fails on any browser console error. The fixture is a fresh mktemp project.
//
//   PORT=3189 pnpm dev   # then:
//   BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/derived-diagrams.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3189"
const fx = makeFixture()
const task = (file, lines) => writeFileSync(path.join(fx, "plans/tasks", file), lines.join("\n") + "\n")
task("T001-first.md", ["# T001: First task", "**Status:** 📋 Todo", "**Covers:** S1", "", "## Goal", "One.", "", "## Manual tests", "### Steps", "- [x] S1 — WHEN a user logs in → THEN they see the board"])
task("T002-second.md", ["# T002: Second task", "**Status:** 👀 Review", "**Depends on:** T001, T099", "**Covers:** S2", "", "## Goal", "Two."])
task("T003-third.md", ["# T003: Third task", "**Status:** 📋 Todo", "**Depends on:** T002", "", "## Goal", "Three."])
task("T004-alone.md", ["# T004: Alone", "**Status:** 📋 Todo", "", "## Goal", "Four."])

writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), [
  "# R002: Epic", "**Parent:** R001", "**Status:** in-progress", "**Order:** 10", "**Tasks:** T001, T002, T003", "",
  "Body.", "", "## Scenarios", "### S1: Log in", "- WHEN a user logs in", "- THEN they see the board",
  "### S2: Log out", "- WHEN they log out", "- THEN they see the login page", "### S3: Reset", "- WHEN they reset", "- THEN a mail goes out", "",
].join("\n"))

mkdirSync(path.join(fx, "docs"), { recursive: true })
writeFileSync(path.join(fx, "docs/hub.md"), "# Hub\n\nSee [out](out.md) and [gone](gone.md).\n")
writeFileSync(path.join(fx, "docs/out.md"), "# Outbound\n\nNothing.\n")
writeFileSync(path.join(fx, "docs/a.md"), "# Alpha\n\nBack to [hub](hub.md).\n")
writeFileSync(path.join(fx, "docs/b.md"), "# Beta\n\nAlso [hub](hub.md).\n")

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // S1: T002's panel draws T001 (upstream), T099 (missing), T003 (downstream) and itself
  await page.goto(`${BASE}/board?task=T002`)
  const panel = page.getByRole("dialog", { name: "Second task" })
  const diagram = panel.locator("[data-task-deps=T002]")
  const node = (id) => diagram.locator(`g.node[id*="flowchart-${id}-"]`)
  await node("T003").waitFor()
  assert.equal(await diagram.locator("g.node").count(), 4)
  const cls = (id) => node(id).getAttribute("class")
  assert.match(await cls("T002"), /\baccent\b/, "the open task is the accent")
  assert.match(await cls("T001"), /\bst-todo\b/)
  assert.match(await cls("T099"), /\bst-missing\b/)
  assert.match(await node("T001").textContent(), /○ T001 · First task/, "glyph + id + title")
  assert.equal(await diagram.locator('g.node[role="link"]').count(), 4, "task nodes are links")
  // dependencies are drawn left of the task, dependents right of it
  const x = async (id) => (await node(id).boundingBox()).x
  assert.ok((await x("T001")) < (await x("T002")) && (await x("T002")) < (await x("T003")), "left to right")
  console.log("ok  S1: T002 shows T001 + missing T099 upstream and T003 downstream, itself the accent")

  // S4: T001 → done elsewhere: its node turns st-done without a reload
  await page.evaluate(() => { window.__noReload = true })
  const res = await fetch(`${BASE}/api/tasks?root=${encodeURIComponent(fx)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: "T001", status: "done" }) })
  assert.equal(res.status, 200)
  await page.waitForFunction(() => /\bst-done\b/.test(document.querySelector('[data-task-deps=T002] g.node[id*="flowchart-T001-"]')?.getAttribute("class") ?? ""), null, { timeout: 15000 })
  assert.match(await node("T001").textContent(), /✓ T001/)
  assert.equal(await page.evaluate(() => window.__noReload), true, "no reload")
  console.log("ok  S4: a status change recolours the node live")

  // S1: Enter on a node opens that task; click too
  await node("T003").focus()
  await page.keyboard.press("Enter")
  await page.getByRole("dialog", { name: "Third task" }).waitFor()
  const third = page.locator("[data-task-deps=T003]")
  await third.locator('g.node[id*="flowchart-T002-"]').waitFor()
  await third.locator('g.node[id*="flowchart-T002-"]').click()
  await page.getByRole("dialog", { name: "Second task" }).waitFor()
  console.log("ok  S1: Enter and click on a node open that task's panel")

  // a task with no dependencies and no dependents: no diagram
  await page.goto(`${BASE}/board?task=T004`)
  await page.getByRole("dialog", { name: "Alone" }).waitFor()
  await page.waitForTimeout(500)
  assert.equal(await page.locator("[data-task-deps]").count(), 0)
  console.log("ok  a task with no dependencies shows no diagram")

  // S1: the task's doc in /docs shows the same diagram
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("plans/tasks/T002-second.md")}`)
  const inDoc = page.locator("[data-task-deps=T002]")
  await inDoc.locator('g.node[id*="flowchart-T003-"]').waitFor()
  assert.equal(await inDoc.locator("g.node").count(), 4)
  console.log("ok  S1: the task doc shows the diagram too")

  // S2: the epic map — tasks in dependency order, scenarios with their proof, coverage edges
  await page.goto(`${BASE}/roadmap?item=R002`)
  const map = page.locator("[data-epic-diagram]")
  const mnode = (id) => map.locator(`g.node[id*="flowchart-${id}-"]`)
  await mnode("S3").waitFor()
  assert.equal(await map.locator("g.node").count(), 6, "3 tasks + 3 scenarios")
  assert.match(await mnode("T001").getAttribute("class"), /\bst-done\b/)
  assert.match(await mnode("S1").getAttribute("class"), /\bsc-passed\b/, "S1 ticked by its covering task")
  assert.match(await mnode("S2").getAttribute("class"), /\bsc-unproven\b/)
  assert.match(await mnode("S3").getAttribute("class"), /\bsc-uncovered\b/, "no task covers S3")
  assert.match(await mnode("S1").textContent(), /✓ S1 · Log in/)
  const fontPx = await mnode("T001").evaluate((n) => n.getBoundingClientRect().height / n.getBBox().height)
  assert.ok(fontPx >= 0.74, `shrunk at most to 75% (${fontPx})`)
  assert.ok((await mnode("T001").boundingBox()).y < (await mnode("T002").boundingBox()).y, "dependency order top to bottom")
  assert.ok((await mnode("S1").boundingBox()).y > (await mnode("T001").boundingBox()).y, "scenarios below the tasks that cover them")
  console.log("ok  S2: the epic map shows 3 tasks and 3 scenarios, passed / unproven / uncovered")

  // a scenario node scrolls to its row and flashes it; a task node opens the task beside the pane
  await mnode("S2").click()
  await page.waitForFunction(() => document.getElementById("scenario-S2")?.classList.contains("animate-flash"))
  await mnode("T003").focus()
  await page.keyboard.press("Enter")
  await page.locator("[data-task-detail=T003]").getByRole("heading", { name: "Third task" }).waitFor()
  console.log("ok  S2: a scenario node flashes its row; Enter on a task node opens the task")

  // S4: T003 → in progress elsewhere recolours its node on the map
  await fetch(`${BASE}/api/tasks?root=${encodeURIComponent(fx)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: "T003", status: "in-progress" }) })
  await page.waitForFunction(() => /\bst-in-progress\b/.test(document.querySelector('[data-epic-diagram] g.node[id*="flowchart-T003-"]')?.getAttribute("class") ?? ""), null, { timeout: 15000 })
  console.log("ok  S4: a task status change recolours the epic map live")

  // S5: the same structure as text over MCP
  const mcp = async (name, args) => {
    const r = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) })
    const j = await r.json()
    return j.result?.content?.[0]?.text ?? JSON.stringify(j)
  }
  const got = await mcp("vibedoc_get_task", { taskId: "T002" })
  assert.match(got, /\n## Dependencies\nWaits on: T001 ✓ done \(First task\) · T099 \(no task file\)\nBlocks: T003 ◐ in-progress \(Third task\)/)
  assert.doesNotMatch(await mcp("vibedoc_get_task", { taskId: "T004" }), /## Dependencies/, "nothing for a task without links")
  const epic = await mcp("vibedoc_get_roadmap", { id: "r002" })
  assert.match(epic, /^### ◐ \*\*R002\*\* Epic/)
  assert.match(epic, /Tasks \(dependency order\):\n- ✓ T001 First task — done · covers S1\n- ◑ T002 Second task — review · after T001 · covers S2\n- ◐ T003 Third task — in-progress · after T002/)
  assert.match(epic, /Scenarios: ✓ S1 Log in — passed · \? S2 Log out — unproven · \? S3 Reset — unproven\nNot covered by any task: S3/)
  const all = await mcp("vibedoc_get_roadmap", {})
  assert.match(all, /^## Roadmap/)
  assert.doesNotMatch(all, /dependency order/, "no id → the overview as before")
  assert.match(await mcp("vibedoc_get_roadmap", { id: "R404" }), /No roadmap item R404/)
  console.log("ok  S5: get_task ends with ## Dependencies; get_roadmap {id} gives the epic map as text")

  // S3: the link map in the Linked docs panel
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/hub.md")}`)
  const linksBtn = page.getByRole("button", { name: /^Linked docs/ }).locator("visible=true").first()
  if ((await linksBtn.getAttribute("aria-pressed")) !== "true") await linksBtn.click()
  const lmap = page.locator("[data-link-map]").locator("visible=true").first()
  // the rail folds the map behind a "Map" toggle; opened, it fits the 18rem box (no sideways scroll)
  await lmap.locator("[data-link-map-toggle]").click()
  const lnode = (id) => lmap.locator(`g.node[id*="flowchart-${id}-"]`)
  await lnode("self").waitFor()
  assert.equal(await lmap.locator("g.node").count(), 5, "hub + 2 inbound + 1 outbound + 1 broken")
  assert.ok(await lmap.locator(".mermaid").evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "the map fits the rail")
  assert.match(await lnode("self").getAttribute("class"), /\baccent\b/)
  assert.match(await lnode("broken0").getAttribute("class"), /\bst-missing\b/)
  assert.equal(await lmap.locator('g.node[role="link"]').count(), 3, "files are links; the doc itself and broken ones are not")
  const ys = async (id) => (await lnode(id).boundingBox()).y
  assert.ok((await ys("in0")) < (await ys("self")) && (await ys("self")) < (await ys("out0")), "inbound above, outbound below")
  assert.match(await lnode("out0").textContent(), /Outbound/)
  await lnode("out0").click()
  await page.waitForURL(/doc=docs%2Fout\.md|doc=docs\/out\.md/)
  await page.getByRole("heading", { level: 1, name: "Outbound" }).first().waitFor()
  console.log("ok  S3: the link map shows 2 inbound, 1 outbound and 1 broken link; clicking a file opens it")

  assert.deepEqual(errors, [], "no console errors")
  console.log("\nderived-diagrams: all checks passed")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
