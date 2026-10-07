// Browser check for T508 (R095 S5): an epic opens as a pane docked left on /roadmap, and a task clicked in it shows
// its detail in the rest of the screen, like Test review's list · detail.
//   1. Click the epic on the map → pane on the left, no dialog / overlay, map still visible.
//   2. Click a task row → its detail fills the rest, map hidden, row marked, URL ?item=R002&task=T002.
//   3. Reload → same state. Walk to another task and a scenario chip without leaving the page.
//   4. "done" in the detail → the pane's row and progress update live.
//   5. Esc closes the task, Esc again the epic; URL follows.
//   6. 390px: pane full screen, a task replaces it with Back.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/roadmap-epic-pane.mjs
import assert from "node:assert/strict"
import { rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), [
  "# R002: Epic", "**Parent:** R001", "**Status:** in-progress", "**Order:** 10", "**Tasks:** T001, T002, T003", "",
  "Checkout.", "", "## Scenarios", "### S1: Buy a plan", "- WHEN the user picks Monthly", "- THEN they see a receipt", "",
].join("\n"))
const task = (id, title, status, extra = "") => writeFileSync(path.join(fx, `plans/tasks/${id}-x.md`),
  `# ${id}: ${title}\n**Status:** ${status}\n**Phase:** R002 — Epic\n**Size:** S\n${extra}\n## Goal\n${title} body text.\n`)
task("T001", "Alpha task", "🔨 In-progress")
task("T002", "Bravo task", "📋 Todo")
task("T003", "Charlie task", "📋 Todo", "**Covers:** S1\n")

const browser = await launchChrome()
const errors = []
const watch = (page) => {
  page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
}
const params = (page) => Object.fromEntries(new URL(page.url()).searchParams)
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  watch(page)
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/roadmap`)
  const map = page.locator(".react-flow")
  const pane = page.getByRole("complementary", { name: "R002 · Epic" })
  const detail = (id) => page.locator(`[data-task-detail=${id}]`)
  const row = (id) => pane.locator(`[data-task-row=${id}]`)

  // 1. pane on the left, map visible, nothing modal
  await page.locator(".react-flow__node[data-id=R002]").click()
  await pane.waitFor()
  assert.equal(await page.locator("[role=dialog]").count(), 0, "no sheet / overlay")
  assert.ok(await map.isVisible(), "map stays visible next to the pane")
  const pb = await pane.boundingBox(), mb = await map.boundingBox()
  assert.ok(pb.x < mb.x && pb.width <= 480, `pane docked left (${pb.x},${pb.width}) before the map (${mb.x})`)
  assert.equal(params(page).item, "R002")
  console.log("ok  epic opens as a left pane; map visible, no overlay")

  // 2. a task fills the rest
  await row("T002").getByRole("button", { name: /Bravo task/ }).click()
  await detail("T002").getByRole("heading", { name: "Bravo task" }).waitFor()
  await detail("T002").getByText("Bravo task body text.").waitFor()
  assert.ok(!(await map.isVisible()), "map hidden behind the task")
  assert.ok(await pane.isVisible(), "pane stays")
  assert.equal(await row("T002").getByRole("button", { name: /Bravo task/ }).getAttribute("aria-current"), "true")
  assert.deepEqual([params(page).item, params(page).task], ["R002", "T002"])
  assert.equal(new URL(page.url()).pathname, "/roadmap")
  console.log("ok  task detail beside the pane; row marked; URL ?item=R002&task=T002")

  // 3. reload keeps it; walking tasks stays on the page
  await page.reload()
  await detail("T002").getByRole("heading", { name: "Bravo task" }).waitFor()
  await pane.waitFor()
  await row("T001").getByRole("button", { name: /Alpha task/ }).click()
  await detail("T001").getByRole("heading", { name: "Alpha task" }).waitFor()
  await pane.getByRole("region", { name: "Scenarios" }).getByRole("button", { name: "T003" }).click()
  await detail("T003").getByRole("heading", { name: "Charlie task" }).waitFor()
  assert.equal(new URL(page.url()).pathname, "/roadmap")
  console.log("ok  reload keeps epic + task; walking rows and a scenario chip stays on /roadmap")

  // 4. a status change in the detail shows in the pane live
  await row("T001").getByRole("button", { name: /Alpha task/ }).click()
  await detail("T001").getByRole("button").filter({ hasText: /^\s*done\s*$/ }).click()
  await pane.getByText("1 of 3 tasks done").waitFor()
  await row("T001").locator("span[title=Done]").waitFor()
  console.log("ok  done in the detail → pane row and progress update")

  // 5. Esc: task, then epic
  await row("T002").getByRole("button", { name: /Bravo task/ }).click()
  await detail("T002").waitFor()
  await page.keyboard.press("Escape")
  await detail("T002").waitFor({ state: "detached" })
  assert.ok(await pane.isVisible() && await map.isVisible())
  assert.equal(params(page).task, undefined)
  await page.keyboard.press("Escape")
  await pane.waitFor({ state: "detached" })
  assert.equal(params(page).item, undefined)
  console.log("ok  Esc closes the task, then the epic")

  // 6. phone width
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
  watch(phone)
  await stubChat(phone, [], { root: fx })
  await phone.goto(`${BASE}/roadmap?item=R002`)
  const ppane = phone.getByRole("complementary", { name: "R002 · Epic" })
  await ppane.waitFor()
  assert.ok(!(await phone.locator(".react-flow").isVisible()), "pane takes the screen")
  assert.ok((await ppane.boundingBox()).width >= 380)
  await ppane.locator("[data-task-row=T002]").getByRole("button", { name: /Bravo task/ }).click()
  await phone.locator("[data-task-detail=T002]").getByRole("heading", { name: "Bravo task" }).waitFor()
  assert.ok(!(await ppane.isVisible()), "task replaces the pane")
  await phone.getByRole("button", { name: "Back to R002" }).click()
  await ppane.waitFor()
  assert.equal(params(phone).task, undefined)
  console.log("ok  390px: pane full screen, task replaces it, Back returns")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
