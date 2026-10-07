// Browser check for T511 (sidebar page children, S8), on a fresh fixture project:
//   1. A task in review + an overdue epic → Board / Manual tests list the task, Roadmap the epic, as needs-action,
//      without opening those pages
//   2. Open T002 and docs/x.md → they show as recent children under Board and Docs; still there after a reload
//   3. Clicking a child lands on that exact item (task panel, epic sheet, doc)
//   4. Collapse Board → children hidden, still after a reload; ←/→ on the focused row toggle it, Enter opens the page
//   5. Approving the task elsewhere removes it from needs-action live (SSE)
//   6. Icon-only sidebar: children hidden, a dot on pages with needs-action items; light + dark; Vietnamese; 390px drawer
// Fails on any browser console error. The fixture is removed in `finally`. SHOTS=<dir> keeps screenshots.
//
//   PORT=3195 pnpm dev   # then:
//   BASE=http://localhost:3195 PW_DIR=<dir with node_modules/playwright> node e2e/sidebar-children.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3195"
const SHOTS = process.env.SHOTS
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const write = (rel, text) => { mkdirSync(path.dirname(path.join(fx, rel)), { recursive: true }); writeFileSync(path.join(fx, rel), text) }
write("plans/tasks/T001-alpha.md", ["# T001: Alpha review", "**Status:** 👀 Review", "**Phase:** R002 — Epic", "", "## Goal", "x", "",
  "## Manual tests", "### Steps", "- [ ] Open the page → it loads", ""].join("\n"))
write("plans/tasks/T002-bravo.md", ["# T002: Bravo work", "**Status:** 📋 Todo", "**Phase:** R002 — Epic", "", "## Goal", "x", ""].join("\n"))
write("plans/roadmap/R002-epic.md", "# R002: Late epic\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Due:** 2020-01-01\n**Tasks:** T001, T002\n")
// the horizon matches its in-progress epic, so R002 is the only drift
write("plans/roadmap/R001-now.md", "# R001: Now\n**Status:** in-progress\n**Order:** 10\n**Tasks:** —\n")
write("docs/x.md", "# X doc\n\nHello.\n")

const browser = await launchChrome()
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  const shot = async (name) => { if (SHOTS) await page.waitForTimeout(400); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }) }

  const kids = (page$, slug) => page$.locator(`#sidebar-items-${slug} [data-sidebar-child]`)
  const refs = async (slug, reason) => kids(page, slug).evaluateAll((els, r) =>
    els.filter((e) => !r || e.dataset.sidebarChild === r).map((e) => e.dataset.ref), reason)

  // 1. needs-action children without opening the pages
  await page.goto(`${BASE}/activity`)
  await kids(page, "board").first().waitFor()
  await kids(page, "roadmap").first().waitFor()
  assert.deepEqual(await refs("board", "needs-action"), ["T001"])
  assert.deepEqual(await refs("manual-tests", "needs-action"), ["T001"])
  assert.deepEqual(await refs("roadmap", "needs-action"), ["R002"])
  assert.match(await kids(page, "roadmap").first().innerText(), /Overdue/)
  assert.match(await kids(page, "board").first().innerText(), /T001[\s\S]*Alpha review[\s\S]*Review/)
  console.log("ok  1: Board / Manual tests list T001 and Roadmap R002 as needs-action, from /activity")
  await shot("1-needs-action-dark")

  // 2. recents: open T002 (board panel) and docs/x.md, then reload
  await page.goto(`${BASE}/board?task=T002`)
  await page.getByText("Bravo work").first().waitFor()
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/x.md")}`)
  await page.getByRole("heading", { name: "X doc" }).first().waitFor()
  await page.waitForFunction(() => document.cookie.includes("vibedoc-recent") && decodeURIComponent(document.cookie).includes("docs/x.md"))
  await page.reload()
  await kids(page, "docs").first().waitFor()
  assert.deepEqual(await refs("board", "recent"), ["T002"])
  assert.deepEqual(await refs("docs", "recent"), ["docs/x.md"])
  console.log("ok  2: T002 and docs/x.md show as recent under Board and Docs, after a reload too")

  // 3. a child opens the exact item
  await page.goto(`${BASE}/activity`)
  await kids(page, "roadmap").first().click()
  await page.waitForURL(/\/roadmap\?item=R002/)
  await page.getByRole("complementary", { name: /R002/ }).getByText("Late epic").first().waitFor()
  await page.keyboard.press("Escape") // the epic sheet is modal
  await page.getByRole("dialog").waitFor({ state: "detached" })
  await kids(page, "board").filter({ hasText: "T002" }).click()
  await page.waitForURL(/\/board\?task=T002/)
  await page.getByRole("dialog").getByText("Bravo work").first().waitFor()
  await page.goto(`${BASE}/activity`)
  // recents only: collapsed off its page until you open it
  assert.equal(await page.locator('[aria-controls="sidebar-items-docs"]').getAttribute("aria-expanded"), "false")
  await page.locator('[aria-controls="sidebar-items-docs"]').click()
  await kids(page, "docs").first().click()
  await page.waitForURL(/\/docs\?doc=docs%2Fx\.md/)
  await page.getByRole("heading", { name: "X doc" }).first().waitFor()
  console.log("ok  3: children open the epic sheet, the task panel and the doc")

  // 4. collapse Board, reload, keys
  await page.goto(`${BASE}/activity`)
  const boardToggle = page.locator('[aria-controls="sidebar-items-board"]')
  assert.equal(await boardToggle.getAttribute("aria-expanded"), "true")
  await boardToggle.click()
  assert.equal(await kids(page, "board").count(), 0)
  await page.reload()
  await kids(page, "roadmap").first().waitFor()
  assert.equal(await kids(page, "board").count(), 0, "Board stays collapsed after a reload")
  const boardLink = page.locator('[data-sidebar="menu-button"][href="/board"]')
  await boardLink.focus()
  await page.keyboard.press("ArrowRight")
  await kids(page, "board").first().waitFor()
  await page.keyboard.press("ArrowLeft")
  await page.waitForFunction(() => !document.querySelector("#sidebar-items-board"))
  await page.keyboard.press("Enter")
  await page.waitForURL(/\/board$/)
  console.log("ok  4: Board collapses, stays collapsed after a reload; →/← toggle, Enter opens the page")

  // 5. approve elsewhere → gone from needs-action live
  await page.goto(`${BASE}/activity`)
  await page.locator('[aria-controls="sidebar-items-board"]').click() // open it again
  await kids(page, "manual-tests").first().waitFor()
  const res = await fetch(`${BASE}/api/tasks/review${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "T001", action: "approve" }) })
  assert.equal(res.status, 200, await res.text())
  await page.waitForFunction(() => !document.querySelector('#sidebar-items-board [data-ref="T001"][data-sidebar-child="needs-action"]'), null, { timeout: 10000 })
  assert.deepEqual(await refs("board", "needs-action"), [])
  console.log("ok  5: approving T001 over the API removes it from Board's needs-action without a reload")

  // 6. icon rail dot, light theme, Vietnamese, phone drawer
  await page.keyboard.press("Control+b")
  await page.waitForSelector('[data-collapsible="icon"]')
  assert.equal(await page.locator("[data-sidebar-child]").count() === 0 || !(await page.locator("[data-sidebar-child]").first().isVisible()), true, "children hidden on the rail")
  const dot = page.locator('[href="/roadmap"] [data-needs-action-dot]')
  assert.ok(await dot.isVisible(), "Roadmap shows a needs-action dot on the rail")
  assert.ok(!(await page.locator('[href="/activity"] [data-needs-action-dot]').count()), "no dot on a page without children")
  await shot("6-rail-dark")
  await page.evaluate(() => document.documentElement.classList.remove("dark"))
  await shot("6-rail-light")
  await page.keyboard.press("Control+b")
  await page.waitForSelector('[data-collapsible=""]', { state: "attached" }).catch(() => {})
  await kids(page, "roadmap").first().waitFor()
  await shot("6-expanded-light")
  await context.addCookies([{ name: "vibedoc-lang", value: "vi", url: BASE }])
  await page.reload()
  await kids(page, "roadmap").first().waitFor()
  assert.match(await kids(page, "roadmap").first().innerText(), /Quá hạn/)
  assert.match(await kids(page, "docs").first().innerText(), /Đã xem/)
  console.log("ok  6: icon rail hides children and dots Roadmap; light theme; Vietnamese hints")

  await page.setViewportSize({ width: 390, height: 800 })
  await page.reload()
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click()
  const drawer = page.locator('[data-mobile="true"]')
  await drawer.locator("#sidebar-items-roadmap [data-sidebar-child]").first().waitFor()
  const box = await drawer.locator("#sidebar-items-roadmap [data-sidebar-child]").first().boundingBox()
  assert.ok(box && box.x + box.width <= 390, "child fits in the drawer")
  await shot("6-phone-vi")
  await drawer.locator("#sidebar-items-roadmap [data-sidebar-child]").first().click()
  await page.waitForURL(/\/roadmap\?item=R002/)
  console.log("ok  6: 390px drawer lists children and a child opens its item")

  assert.deepEqual(errors, [], `console errors:\n${errors.join("\n")}`)
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
