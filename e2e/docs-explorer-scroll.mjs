// Browser check for T504 (R095 S1): the /docs explorer has the viewport's height and scrolls by itself.
// On a fixture with a long doc and a long tree:
//   1. Scrolling the doc to the bottom leaves the explorer's top (DOCS header, search) where it was
//   2. Scrolling inside the explorer moves the tree, not the doc
//   3. The window never scrolls (document.scrollingElement.scrollTop stays 0)
//   4. 390px: the list page and the doc page each scroll in their own pane
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3195 pnpm dev   # then:
//   BASE=http://localhost:3195 PW_DIR=node_modules/.pnpm/playwright@<v>/node_modules/playwright node e2e/docs-explorer-scroll.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3195"
const fx = makeFixture()
mkdirSync(path.join(fx, "docs/many"), { recursive: true })
const long = ["# Long doc", ""]
for (let i = 1; i <= 80; i++) long.push(`## Section ${i}`, "", `Paragraph ${i} of a long doc, enough text to fill a line or two.`, "")
long.push("The very end.")
writeFileSync(path.join(fx, "docs/long.md"), long.join("\n"))
for (let i = 1; i <= 60; i++) writeFileSync(path.join(fx, `docs/many/note-${String(i).padStart(2, "0")}.md`), `# Note ${i}\n`)

// The doc's own scrolling pane: the nearest ancestor of its last line that scrolls
const docScrollTop = (page) => page.evaluate(() => {
  const end = [...document.querySelectorAll("p")].find((p) => p.textContent === "The very end.")
  for (let n = end?.parentElement; n; n = n.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight) return n.scrollTop
  }
  return null
})
const endInView = () => {
  const r = [...document.querySelectorAll("p")].find((p) => p.textContent === "The very end.")?.getBoundingClientRect()
  return !!r && r.top >= 0 && r.bottom <= window.innerHeight
}

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
  await page.goto(`${BASE}/docs?doc=docs/long.md`)
  await page.getByText("The very end.").waitFor()
  const search = page.locator("#doc-search")
  await search.waitFor()
  const windowTop = () => page.evaluate(() => document.scrollingElement.scrollTop)
  // the lint line renders above the search once its fetch lands; measure after it
  await page.locator("[data-doc-lint] [data-lint-summary]").waitFor()
  const before = await search.boundingBox()

  // 1 + 3: the doc scrolls in its own pane, the explorer stays put, the window doesn't move
  await page.mouse.move(900, 500)
  await page.mouse.wheel(0, 20000)
  await page.waitForFunction(endInView)
  assert.ok((await docScrollTop(page)) > 0, "the doc scrolled in its own pane")
  assert.deepEqual(await search.boundingBox(), before, "the search box stays where it was")
  assert.ok(await page.getByText("Docs", { exact: true }).first().isVisible(), "the DOCS header is visible")
  assert.equal(await windowTop(), 0)
  console.log("ok  scrolling the doc to the bottom leaves the explorer's top in place")

  // 2: the tree scrolls inside the explorer; the doc doesn't move
  const docTop = await docScrollTop(page)
  const viewport = page.locator("aside [data-radix-scroll-area-viewport]")
  await page.waitForFunction(() => {
    const v = document.querySelector("aside [data-radix-scroll-area-viewport]")
    return v && v.scrollHeight > v.clientHeight
  })
  const box = await viewport.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 600)
  await page.waitForFunction(() => document.querySelector("aside [data-radix-scroll-area-viewport]").scrollTop > 0)
  assert.equal(await docScrollTop(page), docTop, "the doc did not move")
  assert.deepEqual(await search.boundingBox(), before, "the search box stays where it was")
  assert.equal(await windowTop(), 0)
  console.log("ok  scrolling the explorer moves the tree, not the doc; the window stays at 0")

  // The editor scrolls in its own pane too, also with the pointer right of the text (the pane fills the width)
  await page.getByRole("tab", { name: "Edit" }).click()
  const cm = page.locator(".cm-scroller")
  await cm.waitFor()
  await page.mouse.move(1000, 500)
  await page.mouse.wheel(0, 3000)
  await page.waitForFunction(() => document.querySelector(".cm-scroller").scrollTop > 0)
  assert.deepEqual(await search.boundingBox(), before, "the search box stays where it was")
  assert.equal(await windowTop(), 0)
  await page.getByRole("tab", { name: "Preview" }).click()
  console.log("ok  the editor scrolls in its own pane across its full width")

  // 4: phone width — the list page and the doc page each scroll
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(`${BASE}/docs`)
  await viewport.waitFor()
  await page.waitForFunction(() => {
    const v = document.querySelector("aside [data-radix-scroll-area-viewport]")
    return v && v.scrollHeight > v.clientHeight
  })
  const vb = await viewport.boundingBox()
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2)
  await page.mouse.wheel(0, 600)
  await page.waitForFunction(() => document.querySelector("aside [data-radix-scroll-area-viewport]").scrollTop > 0)
  await page.goto(`${BASE}/docs?doc=docs/long.md`)
  await page.getByText("The very end.").waitFor({ state: "attached" })
  await page.mouse.move(200, 500)
  await page.mouse.wheel(0, 20000)
  await page.waitForFunction(endInView)
  assert.equal(await windowTop(), 0)
  console.log("ok  390px: the list and the doc each scroll in their own pane")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
