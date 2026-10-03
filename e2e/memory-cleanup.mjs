// Browser check for T118 (R051 Cleanup panel), on a fixture project:
//   1. A done task under "Working on now" → /memory shows "Cleanup (1)"; the row links to the task.
//   2. Dismiss → row hidden, memory/.cleanup.json written, vibedoc_read_memory drops the warning; a reload keeps it hidden.
//   3. Moving another task to done on the board API updates the panel live (no reload).
//   4. "Show dismissed" lists the dismissed flag greyed out.
//   5. IDs inside a flag message render in mono (DESIGN.md Grep rule).
//   6. Parallel dismisses all land in .cleanup.json (no lost read-modify-write).
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/memory-cleanup.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const task = (id, title, status) =>
  writeFileSync(path.join(fx, `plans/tasks/${id}-${title.toLowerCase().replace(/\W+/g, "-")}.md`), `# ${id}: ${title}\n**Status:** ${status}\n**Size:** S\n\n## Goal\nx\n`)
task("T001", "Finished thing", "✅ Done")
task("T002", "Ongoing thing", "🔄 In Progress")
mkdirSync(path.join(fx, "memory"), { recursive: true })
writeFileSync(path.join(fx, "memory/MEMORY.md"), "# Project Memory\n\n## Working on now\n- T001 finished thing\n- T002 ongoing thing\n\n## Handoff for next session\nKeep going.\n")
const cleanupFile = path.join(fx, "memory/.cleanup.json")

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
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
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  const panel = page.locator('section[aria-label="Cleanup"]')
  const t001 = '[data-flag="contradiction:working-on:T001"]'

  // 1. Count + row linking to the task
  assert.match(await mcp("vibedoc_read_memory", {}), /Handoff says T001 is in progress, but it is done/)
  await page.goto(`${BASE}/memory`)
  await page.getByRole("button", { name: "Cleanup (1)" }).click()
  await page.waitForURL(/cleanup=1/)
  await panel.locator(t001).getByText("Handoff says T001 is in progress, but it is done").waitFor()
  await panel.locator(t001).getByRole("button", { name: /T001.*Finished thing/ }).click()
  await page.waitForURL(/\/board\?task=T001/)
  console.log("ok  Cleanup (1) and the row opens T001 on the board")

  // 2. Dismiss → hidden, file written, session no longer warns; reload keeps it hidden
  await page.goto(`${BASE}/memory?cleanup=1`)
  const dismissed = page.waitForResponse((r) => r.url().includes("/api/memory/health/dismiss"))
  await panel.locator(t001).getByRole("button", { name: "Dismiss" }).click()
  assert.ok((await dismissed).ok())
  await panel.getByText("Memory looks clean").waitFor()
  await page.getByRole("button", { name: "Cleanup (0)" }).waitFor()
  assert.ok(existsSync(cleanupFile))
  const raw = readFileSync(cleanupFile, "utf8")
  assert.match(raw, /^\{\n  "dismissed": \{\n    "contradiction:working-on:T001": "\d{4}-\d{2}-\d{2}"\n  \}\n\}\n$/)
  assert.doesNotMatch(await mcp("vibedoc_read_memory", {}), /T001 is in progress/)
  await page.reload()
  await panel.getByText("Memory looks clean").waitFor()
  console.log("ok  Dismiss hides the row, writes .cleanup.json, drops the session warning, survives reload")

  // 3. Board move updates the panel live
  const res = await fetch(`${BASE}/api/tasks${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: "T002", status: "done", actor: "human" }) })
  assert.ok(res.ok)
  await panel.locator('[data-flag="contradiction:working-on:T002"]').waitFor({ timeout: 5000 })
  await page.getByRole("button", { name: "Cleanup (1)" }).waitFor()
  console.log("ok  moving T002 to done shows its flag live")

  // 4. Show dismissed → greyed row with its date, no Dismiss button
  await panel.getByLabel(/Show dismissed/).check()
  const row = panel.locator(t001)
  await row.getByText(/dismissed \d{4}-\d{2}-\d{2}/).waitFor()
  assert.equal(await row.getByRole("button", { name: "Dismiss" }).count(), 0)
  assert.ok(Number(await row.evaluate((el) => getComputedStyle(el).opacity)) < 1)
  console.log("ok  Show dismissed lists the dismissed flag greyed out")

  // 5. IDs in the message are mono
  const msgId = panel.locator('[data-flag="contradiction:working-on:T002"] p span', { hasText: "T002" })
  assert.match(await msgId.evaluate((el) => getComputedStyle(el).fontFamily), /mono/i)
  console.log("ok  IDs in the flag message render in mono")

  // 6. Parallel dismisses: every id is saved
  const ids = ["T003", "T004", "T005", "T006"]
  for (const id of ids) task(id, `Batch ${id}`, "✅ Done")
  writeFileSync(path.join(fx, "memory/MEMORY.md"), `# Project Memory\n\n## Working on now\n${ids.map((id) => `- ${id}`).join("\n")}\n`)
  const flagIds = ids.map((id) => `contradiction:working-on:${id}`)
  const results = await Promise.all(flagIds.map((flagId) =>
    fetch(`${BASE}/api/memory/health/dismiss${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: flagId }) })))
  assert.ok(results.every((r) => r.ok), `dismiss statuses: ${results.map((r) => r.status)}`)
  const saved = Object.keys(JSON.parse(readFileSync(cleanupFile, "utf8")).dismissed)
  for (const flagId of [...flagIds, "contradiction:working-on:T001"]) assert.ok(saved.includes(flagId), `${flagId} saved`)
  assert.doesNotMatch(await mcp("vibedoc_read_memory", {}), /T00[3-6] is in progress/)
  console.log("ok  4 parallel dismisses all saved")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
