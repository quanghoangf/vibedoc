// Browser check for the board's task quick view (T509 part): drag its left edge → wider, remembered after a reload;
// ←/→ on the edge resize too; the header's "Open full document" (and ⇧O) opens the task file in /docs; no Edit in the
// panel's menu. Fails on any browser console error.
//
//   BASE=http://localhost:3000 PW_DIR=<dir with node_modules/playwright> node e2e/board-task-panel.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001\n")
writeFileSync(path.join(fx, "plans/tasks/T001-first.md"), "# T001: First task\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n\n## Goal\nSomething to build.\n")

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  const sheet = page.getByRole("dialog", { name: "First task" })
  const edge = page.locator("[data-panel-resize]")
  const width = async () => Math.round((await sheet.boundingBox()).width)
  // the sheet slides in: measure only once its left edge stops moving
  const settled = async () => {
    await sheet.waitFor()
    let last = -1
    for (let i = 0; i < 40; i++) {
      const x = Math.round((await sheet.boundingBox()).x)
      if (x === last) return
      last = x
      await page.waitForTimeout(50)
    }
  }

  // 1. drag the left edge 200px to the left → 200px wider
  await page.goto(`${BASE}/board?task=T001`)
  await settled()
  const before = await width()
  const box = await edge.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 200, box.y + 200, { steps: 8 })
  await page.mouse.up()
  const dragged = await width()
  assert.ok(Math.abs(dragged - (before + 200)) <= 4, `drag widens the panel (${before} → ${dragged})`)
  console.log(`ok  drag: ${before}px → ${dragged}px`)

  // 2. reload → same width (cookie); ←/→ on the focused edge resize
  await page.reload()
  await settled()
  assert.ok(Math.abs((await width()) - dragged) <= 2, "width remembered after a reload")
  await edge.focus()
  await page.keyboard.press("ArrowLeft")
  assert.ok((await width()) > dragged, "← widens")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  assert.ok((await width()) < dragged, "→ narrows")
  console.log("ok  width remembered after a reload; ←/→ on the edge resize")

  // 3. no Edit in the menu; the header button opens the full document
  await sheet.getByRole("button", { name: "Actions for T001" }).click()
  await page.getByRole("menuitem", { name: /Open full document/ }).waitFor()
  assert.equal(await page.getByRole("menuitem", { name: /^Edit/ }).count(), 0, "no Edit item")
  await page.keyboard.press("Escape")
  await sheet.getByRole("button", { name: "Open full document" }).click()
  await page.waitForURL(/\/docs/)
  await page.getByRole("heading", { level: 1, name: /First task/ }).first().waitFor()
  console.log("ok  no Edit in the panel menu; Open full document lands on /docs with the task file")

  // 4. ⇧O from the open panel does the same
  await page.goto(`${BASE}/board?task=T001`)
  await sheet.waitFor()
  await page.keyboard.press("Shift+O")
  await page.waitForURL(/\/docs/)
  console.log("ok  ⇧O opens the full document")

  assert.deepEqual(errors, [], "no console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
}
