// Browser check for parallel agent chats (R044): three breakdowns run at once in the background, the roadmap
// and sidebar show their status, accepting their plans in a different order than they were proposed yields
// unique, contiguous T ids per epic, and chats are saved to .vibedoc/chats (delete + reload).
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/parallel-chats.mjs
//
// Stubs /api/chat (see stub-chat.mjs); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat, toolTurn } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const EPICS = ["R002", "R003", "R004"]

// Fixture: horizon R001 with three task-less epics
const fx = makeFixture()
for (const [i, id] of ["R003", "R004"].entries()) {
  writeFileSync(path.join(fx, `plans/roadmap/${id}-epic-${i + 2}.md`),
    `# ${id}: Epic ${i + 2}\n**Parent:** R001\n**Status:** planned\n**Order:** ${20 + i * 10}\n**Tasks:** —\n`)
}
const tasksDir = path.join(fx, "plans/tasks")

// Each chat answers with a two-task breakdown for the epic named in its message
const plan = (epic) => ({
  kind: "breakdown",
  epic,
  tasks: [
    { key: "t1", title: `${epic} first`, body: "## Goal\nFirst" },
    { key: "t2", title: `${epic} second`, dependsOn: ["t1"], body: "## Goal\nSecond" },
  ],
})

const browser = await launchChrome()
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const calls = await stubChat(page, (call, body) => {
    const epic = body.message.match(/R\d+/)?.[0]
    return toolTurn(`tu${epic}`, "vibedoc_propose_plan", { plan: plan(epic) }, `Plan for ${epic}.`)
      .map((l) => ({ ...l, session_id: `s${epic}` }))
  }, { root: fx })
  // Hold every reply until released, so all chats stay running
  let release
  const hold = new Promise((r) => { release = r })
  let inFlight = 0
  await page.route("**/api/chat**", async (route) => { inFlight++; await hold; await route.fallback() })

  // 1–2. "Break down epics…" with all 3 checked → 3 requests in flight, 3 running tabs
  await page.goto(`${BASE}/roadmap`)
  await page.getByRole("button", { name: "Break down epics…" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByText("Epic 3").waitFor()
  assert.equal(await dialog.locator('input[type="checkbox"]:checked').count(), 3)
  await dialog.getByRole("button", { name: "Break down 3 epics" }).click()
  for (let i = 0; i < 50 && inFlight < 3; i++) await page.waitForTimeout(100)
  assert.equal(inFlight, 3, "3 /api/chat requests in flight before any is released")
  // DOM queries: a dialog aria-hides the rest of the page. The 3 chats run in the background (no modal)
  const SIDEBAR = '[aria-label="Chats"]'
  await page.waitForFunction((s) => document.querySelectorAll(`${s} li button[title]`).length === 3, SIDEBAR)
  await page.waitForFunction((s) => document.querySelectorAll(`${s} [title="Running"]`).length === 3, SIDEBAR)
  await dialog.waitFor({ state: "hidden" })
  assert.equal(await page.getByRole("dialog").count(), 0, "background breakdowns don't open the chat modal")
  console.log("ok  Break down epics… starts 3 chats in the background; 3 requests in flight, 3 running in the sidebar")

  // Each epic on the map shows its chat is working
  const agentMarks = (label) => page.evaluate((l) =>
    [...document.querySelectorAll(`.react-flow__node [aria-label="${l}, open chat"]`)]
      .map((b) => b.closest(".react-flow__node").textContent.match(/R\d+/)?.[0]).sort(), label)
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node [aria-label="Agent working, open chat"]').length === 3)
  assert.deepEqual(await agentMarks("Agent working"), EPICS)
  console.log("ok  map: all 3 epics show Agent working")

  // 3. Release all → every tab needs review; accept in a different order than created
  release()
  await page.waitForFunction((s) => document.querySelectorAll(`${s} [title="Plan or edit to review"]`).length === 3, SIDEBAR)
  assert.deepEqual(calls.map((c) => c.message).sort(), EPICS.map((e) => `Break down epic ${e} into tasks.`))
  console.log("ok  released: all 3 chats show review in the sidebar")
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node [aria-label="Plan to review, open chat"]').length === 3)
  assert.deepEqual(await agentMarks("Plan to review"), EPICS)
  console.log("ok  map: all 3 epics show Plan to review")

  // Clicking an epic's mark opens that epic's chat
  await page.locator(".react-flow__node", { hasText: "R003" }).getByRole("button", { name: /open chat/ }).dispatchEvent("click")
  await page.getByRole("dialog", { name: "Break down R003" }).waitFor()
  await page.keyboard.press("Escape")
  console.log("ok  clicking the R003 mark opens the R003 chat")

  const acceptOrder = ["R004", "R002", "R003"]
  for (const epic of acceptOrder) {
    await page.locator(`${SIDEBAR} button`, { hasText: `Break down ${epic}` }).click()
    const modal = page.getByRole("dialog", { name: `Break down ${epic}` })
    await modal.getByText(`Plan for ${epic}.`).waitFor()
    await modal.getByRole("button", { name: "Accept (2)" }).click()
    await modal.getByText("✓ Created").waitFor()
    await page.keyboard.press("Escape")
    await modal.waitFor({ state: "hidden" })
  }
  await page.waitForFunction((s) => !document.querySelector(`${s} [title="Plan or edit to review"]`), SIDEBAR)
  console.log(`ok  accepted all 3 plans in order ${acceptOrder.join(", ")}`)
  await page.waitForFunction(() => !document.querySelector('.react-flow__node [aria-label$=", open chat"]'))
  console.log("ok  map: agent marks clear once the plans are reviewed")

  // 4. T ids unique and contiguous; each epic lists only its own, assigned in accept order
  const files = readdirSync(tasksDir).sort()
  const nums = files.map((f) => Number(f.slice(1, 4)))
  assert.equal(files.length, 6, `expected 6 task files, got ${files}`)
  assert.equal(new Set(nums).size, 6, "unique T ids")
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6], "contiguous T ids")
  const epicTasks = (id) => {
    const file = readdirSync(path.join(fx, "plans/roadmap")).find((f) => f.startsWith(`${id}-`))
    return readFileSync(path.join(fx, "plans/roadmap", file), "utf8").match(/^\*\*Tasks:\*\* (.*)$/m)[1].split(", ")
  }
  acceptOrder.forEach((epic, i) => {
    const own = [`T00${2 * i + 1}`, `T00${2 * i + 2}`]
    assert.deepEqual(epicTasks(epic), own, `${epic} lists only its own tasks`)
    for (const id of own) {
      const task = readFileSync(path.join(tasksDir, files.find((f) => f.startsWith(id))), "utf8")
      assert.match(task, new RegExp(`^# ${id}: ${epic} `, "m"))
      assert.match(task, new RegExp(`^\\*\\*Phase:\\*\\* ${epic} `, "m"))
    }
  })
  console.log(`ok  ${files.length} task files, T001–T006 unique and contiguous; each epic lists only its own`)

  // 5. /chat lists all 3; deleting one removes only that chat, here and in the sidebar, and its saved file
  await page.locator(`${SIDEBAR} a`, { hasText: "All chats" }).click()
  const list = page.getByRole("complementary", { name: "All chats" })
  await list.getByRole("button", { name: /Break down R003/ }).first().waitFor()
  const savedBefore = readdirSync(path.join(fx, ".vibedoc/chats")).length
  assert.equal(savedBefore, 3, "each chat is saved to .vibedoc/chats")
  await list.getByRole("button", { name: "Close Break down R003" }).click()
  await page.waitForFunction((s) => document.querySelectorAll(`${s} li button[title]`).length === 2, SIDEBAR)
  assert.equal(await list.getByRole("button", { name: /Break down R003/ }).first().count(), 0)
  await list.getByRole("button", { name: /Break down R002/ }).first().waitFor()
  for (let i = 0; i < 20 && readdirSync(path.join(fx, ".vibedoc/chats")).length !== 2; i++) await page.waitForTimeout(100)
  assert.equal(readdirSync(path.join(fx, ".vibedoc/chats")).length, 2, "the deleted chat's file is gone")
  console.log("ok  /chat lists every chat; deleting one removes it everywhere, file included")

  // 6. Reload: chats come back from .vibedoc/chats with their plans resolved
  await page.reload()
  await page.getByRole("complementary", { name: "All chats" }).getByRole("button", { name: /Break down R004/ }).first().waitFor()
  assert.equal(await page.locator(`${SIDEBAR} li button[title]`).count(), 2)
  console.log("ok  chats survive a reload")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
