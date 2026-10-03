// Browser check for T121 (R051 "Not recalled lately"), on a fixture project:
//   1. An entry updated 90 days ago and never recalled shows "never recalled"; one recalled long ago shows "last recalled N days ago".
//   2. vibedoc_get_entries writes today's date to memory/.recall-log.json (once a day) and the row disappears live.
//   3. Delete from a row removes the entry (and its log line) with an Undo toast; Undo brings it back, panel stays open.
//      Keyboard focus moves to the next row's action, or to the Cleanup heading when no rows are left.
//   4. Merging entries drops the merged-away ids from the recall log too.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/memory-stale.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const ymd = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toLocaleDateString("en-CA") }
const today = ymd(0)
mkdirSync(path.join(fx, "memory/entries"), { recursive: true })
writeFileSync(path.join(fx, "memory/MEMORY.md"), "# Project Memory\n\n## Handoff for next session\nKeep going.\n")
const entry = (id, summary, updated) =>
  writeFileSync(path.join(fx, `memory/entries/${id}-${summary.toLowerCase().replace(/\W+/g, "-")}.md`), `# ${id}: ${summary}\n**Type:** convention\n**Updated:** ${updated}\n\nBody of ${id}.\n`)
entry("E001", "Old never read fact", ymd(90))
entry("E002", "Read long ago fact", ymd(200))
entry("E003", "Fresh fact", today)
entry("E004", "Another old fact", ymd(100))
const logFile = path.join(fx, "memory/.recall-log.json")
writeFileSync(logFile, JSON.stringify({ E002: ymd(74) }, null, 2) + "\n")

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
  const e1 = panel.locator('[data-flag="stale:E001"]')
  const e2 = panel.locator('[data-flag="stale:E002"]')

  // 1. Rows with their recall wording; the fresh entry isn't listed
  await page.goto(`${BASE}/memory?cleanup=1`)
  await panel.getByText(/Not recalled lately/).waitFor()
  await e1.getByText("E001 never recalled (updated 90 days ago)").waitFor()
  await e2.getByText("E002 last recalled 74 days ago").waitFor()
  assert.equal(await panel.locator('[data-flag="stale:E003"]').count(), 0)
  console.log("ok  never recalled / last recalled 74 days ago rows; fresh entry not flagged")

  // 2. get_entries stamps today once and the row disappears live
  assert.match(await mcp("vibedoc_get_entries", { ids: ["E001"] }), /## E001/)
  const log = JSON.parse(readFileSync(logFile, "utf8"))
  assert.deepEqual(Object.keys(log), ["E001", "E002"])
  assert.equal(log.E001, today)
  const mtime = statSync(logFile).mtimeMs
  await new Promise((r) => setTimeout(r, 50))
  await mcp("vibedoc_get_entries", { ids: ["e1"] })
  assert.equal(statSync(logFile).mtimeMs, mtime, "same-day recall doesn't rewrite the log")
  await e1.waitFor({ state: "detached", timeout: 5000 })
  console.log("ok  vibedoc_get_entries writes today once; the row disappears live")

  // 3. Delete → Undo toast → Undo restores; panel stays open
  const deleted = page.waitForResponse((r) => r.url().includes("/api/memory/entries/delete"))
  await e2.getByRole("button", { name: "Delete" }).focus()
  await page.keyboard.press("Enter")
  assert.ok((await deleted).ok())
  await e2.waitFor({ state: "detached" })
  const focused = () => page.evaluate(() => { const a = document.activeElement; return `${a?.closest("[data-flag]")?.getAttribute("data-flag") ?? ""}|${a?.tagName}|${a?.textContent?.trim()}` })
  await page.waitForFunction(() => document.activeElement?.tagName !== "BODY")
  assert.equal(await focused(), "stale:E004|BUTTON|Delete", "focus moves to the next row's Delete")
  assert.ok(!existsSync(path.join(fx, "memory/entries/E002-read-long-ago-fact.md")))
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(logFile, "utf8"))), ["E001"], "delete drops the id from the recall log")
  assert.match(page.url(), /cleanup=1/)
  await page.getByRole("button", { name: "Undo" }).click()
  await e2.getByText(/E002 never recalled/).waitFor({ timeout: 5000 })
  assert.ok(existsSync(path.join(fx, "memory/entries/E002-read-long-ago-fact.md")))
  console.log("ok  Delete removes the entry with Undo; Undo brings it back (not re-added to the log); focus moves to the next row")

  // last row gone → focus lands on the Cleanup heading
  await panel.locator('[data-flag="stale:E002"]').waitFor()
  const dismissed4 = page.waitForResponse((r) => r.url().includes("/api/memory/health/dismiss") && r.request().postData()?.includes("stale:E004"))
  await panel.locator('[data-flag="stale:E004"]').getByRole("button", { name: "Dismiss" }).focus()
  await page.keyboard.press("Enter")
  assert.ok((await dismissed4).ok())
  const dismissed = page.waitForResponse((r) => r.url().includes("/api/memory/health/dismiss") && r.request().postData()?.includes("stale:E002"))
  await panel.locator('[data-flag="stale:E002"]').getByRole("button", { name: "Dismiss" }).focus()
  await page.keyboard.press("Enter")
  assert.ok((await dismissed).ok())
  await panel.getByText("Memory looks clean").waitFor()
  await page.waitForFunction(() => document.activeElement?.tagName === "H2")
  console.log("ok  Dismissing the last row moves focus to the Cleanup heading")

  // 4. Merge drops the merged-away id from the recall log
  writeFileSync(logFile, JSON.stringify({ E001: today, E002: today, E004: today }, null, 2) + "\n")
  const res = await fetch(`${BASE}/api/memory/entries/merge${q}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keepId: "E002", dropIds: ["E004"], type: "convention", summary: "Read long ago fact", body: "Merged." }),
  })
  assert.ok(res.ok, await res.text())
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(logFile, "utf8"))), ["E001", "E002"], "merge drops E004 from the recall log")
  console.log("ok  merge drops the merged-away id from the recall log")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
