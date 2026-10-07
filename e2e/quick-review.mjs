// Browser check for T510 (quick review from the board), end to end on a fixture project:
//   1. Table: only the review row has a Review button → it opens the checklist + auto-run line on /board →
//      tick → the row's 🧪 count moves, the file has - [x] (still ticked after a reload) → Esc closes, focus is
//      back on the button.
//   2. Approve from the quick review → Done in the table and on the board.
//   3. Board and By epic views: the same button on the review card / row → Send back with a note → Todo, the
//      note in ## Review.
// Fails on any browser console error.
//
//   BASE=http://localhost:3000 PW_DIR=<dir with node_modules/playwright> node e2e/quick-review.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const report = (auto) => `\n## Manual tests\n_2026-10-01 — ai_ · Spec: \`e2e/x.spec.ts\` · Auto: ${auto}\n### Steps\n- [ ] 🤖 Open the page → it loads\n- [ ] Click Save → a toast says saved\n### Regression risk\n- [ ] Board still loads\n`
const files = {
  T001: "T001-first.md", T002: "T002-second.md", T003: "T003-third.md", T004: "T004-fourth.md",
}
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001, T002, T003, T004\n")
writeFileSync(path.join(fx, "plans/tasks", files.T001), `# T001: First\n**Status:** 👀 Review\n**Phase:** R002 — Epic\n**Depends on:** —\n${report("failed 2026-10-01")}`)
writeFileSync(path.join(fx, "plans/tasks", files.T002), `# T002: Second\n**Status:** 🔨 In progress\n**Phase:** R002 — Epic\n**Depends on:** —\n${report("passed 2026-10-01")}`)
writeFileSync(path.join(fx, "plans/tasks", files.T003), `# T003: Third\n**Status:** 👀 Review\n**Phase:** R002 — Epic\n**Depends on:** —\n${report("passed 2026-10-02")}`)
writeFileSync(path.join(fx, "plans/tasks", files.T004), `# T004: Fourth\n**Status:** 👀 Review\n**Phase:** R002 — Epic\n**Depends on:** —\n${report("passed 2026-10-02")}`)
const file = (id) => readFileSync(path.join(fx, "plans/tasks", files[id]), "utf8")
async function until(fn, what) {
  for (let i = 0; i < 50; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. Table view: the button only on review rows; the quick review opens in place
  await page.goto(`${BASE}/board?view=table`)
  const row = (id) => page.locator("tr", { has: page.getByText(id, { exact: true }) })
  await row("T001").getByRole("button", { name: "Quick review of T001" }).waitFor()
  assert.equal(await row("T002").getByRole("button", { name: /Quick review/ }).count(), 0, "no button on an in-progress row")
  assert.equal(await row("T001").locator("[data-tests-count]").textContent(), "0/3")
  await row("T001").getByRole("button", { name: "Quick review of T001" }).click()
  const pop = page.getByRole("dialog", { name: /T001/ })
  await pop.waitFor()
  assert.match(page.url(), /\/board/, "still on the board")
  assert.match(await pop.locator("[data-auto-run]").textContent(), /Auto run failed · 2026-10-01/)
  await pop.getByLabel("Automated").first().waitFor() // the 🤖 item is marked as such
  await pop.getByRole("link", { name: /Open in Test review/ }).waitFor()
  assert.match(await pop.getByRole("link", { name: /Evidence/ }).getAttribute("href"), /\/manual-tests\?tab=all&task=T001&view=evidence/)

  await pop.getByRole("checkbox", { name: /Click Save/ }).check()
  await page.waitForFunction(() => document.querySelector("tr:has([data-quick-review=T001]) [data-tests-count]")?.textContent === "1/3")
  await until(() => file("T001").includes("- [x] Click Save"), "tick written to T001")
  await page.keyboard.press("Escape")
  await pop.waitFor({ state: "hidden" })
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-quick-review")), "T001", "focus back on the row's button")
  await page.reload()
  assert.equal(await row("T001").locator("[data-tests-count]").textContent(), "1/3", "tick survives a reload")
  console.log("ok  table: Review only on review rows → checklist + auto run → tick moves 🧪 1/3, saved → Esc returns focus")

  // 2. Approve → Done in the table and on the board
  await row("T001").getByRole("button", { name: "Quick review of T001" }).click()
  await pop.getByRole("button", { name: "Approve" }).click()
  await pop.waitFor({ state: "hidden" })
  await until(() => /\*\*Status:\*\* ✅ Done/.test(file("T001")), "T001 done")
  await row("T001").getByText("Done", { exact: true }).waitFor()
  assert.equal(await row("T001").getByRole("button", { name: /Quick review/ }).count(), 0, "a done row has no button")
  await page.goto(`${BASE}/board`)
  await page.locator('[data-column="done"]').getByText("T001").waitFor() // collapsed Done lists ids
  console.log("ok  approve → done in the table and on the board")

  // 3. Board card: the same button → Send back with a note
  const card = page.locator("[draggable=true]", { hasText: "Third" })
  await card.getByRole("button", { name: "Quick review of T003" }).click()
  const pop3 = page.getByRole("dialog", { name: /T003/ })
  assert.match(await pop3.locator("[data-auto-run]").textContent(), /Auto run passed · 2026-10-02/)
  await pop3.getByLabel("Proven by the last run").waitFor() // passed run: the 🤖 item is proven, not a box
  await pop3.getByRole("button", { name: "Send back…" }).click()
  await pop3.getByLabel("Send back note").fill("Toast text is wrong")
  await pop3.getByRole("button", { name: "Send back", exact: true }).click()
  await pop3.waitFor({ state: "hidden" })
  await until(() => /\*\*Status:\*\* 📋 Todo/.test(file("T003")), "T003 back to todo")
  assert.match(file("T003"), /## Review\n### \S+ — changes requested\nToast text is wrong/)
  console.log("ok  board card: Review → send back with a note → todo, note in ## Review")

  // By epic: the review row has it too
  await page.goto(`${BASE}/board?view=epic`)
  await page.getByRole("button", { name: "Quick review of T004" }).click()
  await page.getByRole("dialog", { name: /T004/ }).getByRole("checkbox", { name: /Board still loads/ }).waitFor()
  assert.equal(await page.getByRole("button", { name: /Quick review of T00[123]/ }).count(), 0, "only the review row")
  console.log("ok  by epic: Review on the review row only")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
