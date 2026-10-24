// Browser check: default views open on what's happening now, not on history (UI critique 2026-10-23, P1).
//   1. /roadmap: a horizon whose epics are all done draws as one node ("1 epic · all done"); Show / Collapse
//      toggle its epics; the camera opens on the first horizon with live work, not on the shipped one.
//   2. /roadmap?view=timeline: with no Due dates, epics are drawn over their tasks' Started → Done span (dashed,
//      data-derived) and the "No dates yet" message is gone.
//   3. /board: Status › Epic lanes put review / in-progress first, then todo, then paused-only, done last.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/default-views.mjs
import assert from "node:assert/strict"
import { rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const item = (file, lines) => writeFileSync(path.join(fx, "plans/roadmap", file), lines.join("\n") + "\n")
item("R001-now.md", ["# R001: Shipped", "**Status:** done", "**Order:** 10", "**Tasks:** —"])
item("R002-epic.md", ["# R002: Old epic", "**Parent:** R001", "**Status:** done", "**Order:** 10", "**Tasks:** T001"])
item("R003-now.md", ["# R003: Now", "**Status:** in-progress", "**Order:** 20", "**Tasks:** —"])
item("R004-live.md", ["# R004: Live epic", "**Parent:** R003", "**Status:** in-progress", "**Order:** 10", "**Tasks:** T002, T003"])
item("R005-paused.md", ["# R005: Paused epic", "**Parent:** R003", "**Status:** paused", "**Order:** 20", "**Tasks:** T004"])
item("R006-next.md", ["# R006: Next epic", "**Parent:** R003", "**Status:** planned", "**Order:** 30", "**Tasks:** T005"])
const task = (id, epic, status, extra = "") => writeFileSync(path.join(fx, `plans/tasks/${id}-x.md`),
  `# ${id}: Task ${id}\n**Status:** ${status}\n**Phase:** ${epic}\n**Size:** S\n${extra}\n## Goal\nBody.\n`)
task("T001", "R002 — Old epic", "done", "**Started:** 2026-08-03\n**Done:** 2026-08-20\n")
task("T002", "R004 — Live epic", "in-progress", "**Started:** 2026-10-01\n")
task("T003", "R004 — Live epic", "review", "**Started:** 2026-10-02\n")
task("T004", "R005 — Paused epic", "paused")
task("T005", "R006 — Next epic", "todo")

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  const node = (id) => page.locator(`.react-flow__node[data-id=${id}]`)

  // 1. collapsed shipped horizon, camera on R003
  await page.goto(`${BASE}/roadmap`)
  await node("R004").waitFor()
  assert.equal(await node("R002").count(), 0, "a done horizon's epics are hidden")
  await node("R001").getByText("1 epic · all done").waitFor()
  const top = (await page.locator(".react-flow").boundingBox()).y
  // the camera frames once the tasks are in (they decide which epics are live): poll, don't read once
  const offset = async (id) => (await node(id).boundingBox()).y - top
  for (let i = 0; i < 50 && !((await offset("R004")) >= 0 && (await offset("R004")) < 120); i++) await page.waitForTimeout(100)
  assert.ok((await offset("R004")) >= 0 && (await offset("R004")) < 120, `the live epic starts at the top edge (R004 at ${await offset("R004")}px)`)
  assert.ok((await offset("R003")) < 300, `the camera opens on the live horizon (R003 at ${await offset("R003")}px)`)
  // the shipped horizon sits above the framed one: pan the map down to reach it, as a user would
  const flow = await page.locator(".react-flow").boundingBox()
  await page.mouse.move(flow.x + 20, flow.y + 100)
  await page.mouse.down()
  await page.mouse.move(flow.x + 20, flow.y + 400, { steps: 8 })
  await page.mouse.up()
  await node("R001").getByRole("button", { name: "Show the epics of Shipped" }).click()
  await node("R002").waitFor()
  assert.equal(new URL(page.url()).searchParams.get("item"), null, "Show doesn't open the horizon's sheet")
  await node("R001").getByRole("button", { name: "Collapse the epics of Shipped" }).click()
  await node("R002").waitFor({ state: "detached" })
  console.log("ok  roadmap: shipped horizon collapsed (Show / Collapse), camera on the live horizon")

  // 2. timeline falls back to Started / Done
  await page.goto(`${BASE}/roadmap?view=timeline`)
  const derived = page.locator("button[data-derived]")
  await derived.first().waitFor()
  assert.ok(await page.locator('button[data-derived][title^="R004"]').count() === 1, "R004 is drawn from its tasks' dates")
  assert.match(await page.locator('button[data-derived][title^="R004"]').getAttribute("title"), /from its tasks/)
  assert.equal(await page.getByText("No dates yet.", { exact: false }).count(), 0, "no empty message when tasks have dates")
  console.log("ok  timeline: epics without Due are drawn from Started → Done (derived)")

  // 3. board lanes: review / in-progress first, todo, paused, done
  await page.goto(`${BASE}/board`)
  await page.locator("section[aria-label^='R004']").first().waitFor()
  const lanes = await page.locator("section[aria-label^='R00']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").slice(0, 4)))
  assert.deepEqual(lanes.filter((id, i) => lanes.indexOf(id) === i), ["R004", "R006", "R005", "R002"])
  console.log("ok  board: lanes with review / in-progress first, then todo, paused, done")

  assert.deepEqual(errors, [], "no console errors")
  console.log("\ndefault-views: all checks passed")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
