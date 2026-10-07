// Browser check for T507 (R095 S4): from a task doc in /docs to its manual tests in Test review.
//   1. A task doc with `## Manual tests`: the Manual tests property row shows done/total and the auto result;
//      clicking it lands on /manual-tests with that task selected; Evidence goes to view=evidence
//   2. The heading action at `## Manual tests`, the header chip and ⇧T go to the same place
//   3. A task without a checklist says "No manual tests yet" (no links); a normal doc shows none of it
//   4. The board card's 🧪 badge still links to the same evidence URL (now via testReviewHref)
//   5. Vietnamese labels; 390px wide in light and dark without sideways scroll (`SHOTS=<dir>` saves screenshots)
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3195 pnpm dev   # then:
//   BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@<v>/node_modules/playwright node e2e/doc-manual-tests.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3195"
const SHOTS = process.env.SHOTS
const fx = makeFixture()
mkdirSync(path.join(fx, "docs"), { recursive: true })
const T1 = "plans/tasks/T001-tested-task.md"
writeFileSync(path.join(fx, T1), [
  "# T001: Tested task", "**Status:** 👀 Review", "**Phase:** R002 — Epic", "**Size:** S (~1 hr)", "",
  "## Goal", "Something worth testing.", "",
  "## Manual tests", "_2026-10-04 — ai · Auto: passed 2026-10-05_", "### Steps",
  "- [x] 🤖 Open the page → it loads", "- [ ] Click Save → the toast says Saved", "- [ ] Reload → the value stays", "",
].join("\n"))
const T2 = "plans/tasks/T002-untested-task.md"
writeFileSync(path.join(fx, T2), "# T002: Untested task\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n\n## Goal\nNo checklist yet.\n")
writeFileSync(path.join(fx, "docs/guide.md"), "# Guide\n\n## Manual tests\n\nA heading of the same name in a normal doc.\n")

const review = "/manual-tests?tab=all&task=T001"
const docUrl = (p) => `${BASE}/docs?doc=${encodeURIComponent(p)}`

const browser = await launchChrome()
const errors = []
async function open(ctxOpts = {}, lang = "en") {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...ctxOpts })
  await ctx.addCookies([{ name: "vibedoc-lang", value: lang, url: BASE }])
  const page = await ctx.newPage()
  page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  return { ctx, page }
}

try {
  const { ctx, page } = await open()
  await page.goto(docUrl(T1))
  await page.locator("#manual-tests").waitFor()

  // 1. the property row
  const rowChip = page.locator("[data-doc-evidence]").locator("xpath=..").locator("[data-doc-tests]")
  await rowChip.waitFor()
  assert.equal((await rowChip.innerText()).trim(), "1/3")
  assert.equal(await rowChip.getAttribute("href"), review)
  const rowText = await page.locator("[data-doc-evidence]").locator("xpath=..").innerText()
  assert.match(rowText, /passed/)
  assert.match(rowText, /2026-10-05/)
  assert.equal(await page.locator("[data-doc-evidence]").getAttribute("href"), `${review}&view=evidence`)
  assert.match(await page.locator("header").filter({ has: rowChip }).innerText(), /Manual tests/)
  console.log("ok  1. the Manual tests row shows 1/3 and passed 2026-10-05; Evidence → view=evidence")

  // 2. the heading action and the header chip go to the same place
  const headingChip = page.locator("#manual-tests [data-doc-tests]")
  assert.equal(await headingChip.getAttribute("href"), review)
  assert.match(await headingChip.innerText(), /1\/3\s*Open in Test review/)
  const chips = page.locator("[data-doc-tests]")
  assert.equal(await chips.count(), 3, "header chip, property row, heading action")
  for (const href of await chips.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) assert.equal(href, review)

  await rowChip.click()
  await page.waitForURL((u) => u.pathname === "/manual-tests" && u.searchParams.get("task") === "T001")
  console.log("ok  2. row, heading action and header chip all open /manual-tests with T001; clicking the row lands there")

  await page.goto(docUrl(T1))
  await page.locator("#manual-tests [data-doc-tests]").waitFor()
  await page.locator("body").click({ position: { x: 5, y: 400 } })
  await page.keyboard.press("Shift+T")
  await page.waitForURL((u) => u.pathname === "/manual-tests" && u.searchParams.get("task") === "T001")
  console.log("ok  ⇧T on the task doc opens it in Test review")

  // 3. empty and non-task docs
  await page.goto(docUrl(T2))
  await page.locator("[data-doc-tests-empty]").waitFor()
  assert.equal((await page.locator("[data-doc-tests-empty]").innerText()).trim(), "No manual tests yet")
  assert.equal(await page.locator("[data-doc-tests], [data-doc-evidence]").count(), 0, "no dead links")
  await page.goto(docUrl("docs/guide.md"))
  await page.locator("#manual-tests").waitFor()
  assert.equal(await page.locator("[data-doc-tests], [data-doc-tests-empty], [data-doc-evidence]").count(), 0)
  console.log("ok  3. a task without a checklist says No manual tests yet; a normal doc shows none of it")

  // 4. the board card's badge, through the helper
  await page.goto(`${BASE}/board`)
  await page.locator(`a[href="${review}&view=evidence"]`).first().waitFor()
  console.log("ok  4. the board card's 🧪 badge links to the same evidence URL")
  await ctx.close()

  // 5. Vietnamese, phone width, light + dark
  for (const scheme of ["light", "dark"]) {
    const v = await open({ viewport: { width: 390, height: 844 }, colorScheme: scheme }, "vi")
    await v.page.goto(docUrl(T1))
    await v.page.locator("#manual-tests [data-doc-tests]").waitFor()
    await v.page.evaluate((s) => document.documentElement.classList.toggle("dark", s === "dark"), scheme)
    assert.match(await v.page.locator("#manual-tests [data-doc-tests]").innerText(), /Mở trong Duyệt kiểm thử/)
    assert.match(await v.page.locator("header").filter({ has: v.page.locator("[data-doc-evidence]") }).innerText(), /Kiểm thử thủ công[\s\S]*Bằng chứng/)
    const overflow = await v.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `no sideways scroll at 390px (${scheme}): ${overflow}px`)
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true })
      await v.page.locator("header").filter({ has: v.page.locator("[data-doc-evidence]") }).screenshot({ path: path.join(SHOTS, `doc-tests-row-${scheme}.png`) })
      await v.page.locator("#manual-tests").screenshot({ path: path.join(SHOTS, `doc-tests-heading-${scheme}.png`) })
      await v.page.screenshot({ path: path.join(SHOTS, `doc-tests-390-${scheme}.png`) })
    }
    await v.page.goto(docUrl(T2))
    await v.page.locator("[data-doc-tests-empty]").waitFor()
    assert.equal((await v.page.locator("[data-doc-tests-empty]").innerText()).trim(), "Chưa có kiểm thử thủ công")
    await v.ctx.close()
  }
  console.log("ok  5. Vietnamese labels; 390px light + dark without sideways scroll")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
