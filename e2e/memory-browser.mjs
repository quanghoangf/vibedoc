// Browser check for R047 (Memory browser), end to end on a fixture project. The epic's Done-when:
// a user finds a wrong entry through search, fixes or deletes it in the Memory tab, and the next agent
// session (vibedoc_read_memory) sees the change.
//   1. Agents save three entries (one wrong) → /memory lists them with an agent chip.
//   2. Search finds the wrong one first → open → Edit → fix → Save → file renamed, "human" chip,
//      and the next vibedoc_read_memory shows the fix.
//   3. Delete another → Undo → it is back; delete it again → vibedoc_read_memory no longer lists it.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/memory-browser.mjs
//
// Uses the real /api/mcp and routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
mkdirSync(path.join(fx, "memory"), { recursive: true })
writeFileSync(path.join(fx, "memory/MEMORY.md"), "# Project Memory\n\n## Handoff for next session\nKeep going.\n")
const entriesDir = path.join(fx, "memory/entries")
const entryFile = (id) => readdirSync(entriesDir).find((f) => f.startsWith(`${id}-`))

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
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
    // the app has no favicon; not this feature's concern
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  const list = page.locator('section[aria-label="Knowledge entries"]')

  // 1. Agents save entries; one of them is wrong
  await mcp("vibedoc_save_entry", { type: "convention", summary: "Tailwind only, no CSS-in-JS", agent: "claude" })
  await mcp("vibedoc_save_entry", { type: "decision", summary: "Tasks live in a Postgres database", body: "Wrong: files are the source of truth.", agent: "claude" })
  await mcp("vibedoc_save_entry", { type: "gotcha", summary: "The SSE bus drops events on project switch", agent: "cursor" })
  assert.match(readFileSync(path.join(entriesDir, entryFile("E002")), "utf8"), /\*\*By:\*\* ai:claude/)
  await page.goto(`${BASE}/memory`)
  await list.getByText("Tasks live in a Postgres database").waitFor()
  await list.getByText("claude").first().waitFor()
  console.log("ok  agents' entries listed with their agent chip")

  // 2. Find the wrong entry through search, fix it, and the next session sees the fix
  await page.fill("#memory-search", "postgres database")
  const first = list.locator("li button").first()
  assert.match(await first.innerText(), /E002/)
  await first.click()
  await page.waitForURL(/entry=E002/)
  const detail = page.locator('section[aria-label="E002"]')
  await detail.getByRole("button", { name: "Edit" }).click()
  await page.getByLabel("Summary (one line)").fill("Tasks live in markdown files, no database")
  await page.getByRole("button", { name: "Save" }).click()
  await detail.getByText("Tasks live in markdown files, no database").waitFor()
  await detail.getByText("human").waitFor()
  assert.equal(entryFile("E002"), "E002-tasks-live-in-markdown-files-no-database.md")
  assert.match(readFileSync(path.join(entriesDir, entryFile("E002")), "utf8"), /\*\*By:\*\* human/)
  const session = await mcp("vibedoc_read_memory", {})
  assert.match(session, /E002 · decision · Tasks live in markdown files, no database/)
  assert.doesNotMatch(session, /Postgres/)
  console.log("ok  search → open → fix → Save → file renamed, By: human, next session sees the fix")

  // 3. Delete → Undo → delete again; the next session no longer lists it
  await page.fill("#memory-search", "")
  await list.getByRole("button", { name: /SSE bus drops events/ }).click()
  const e3 = page.locator('section[aria-label="E003"]')
  await e3.getByRole("button", { name: "Delete" }).click()
  await page.getByText("Deleted E003").waitFor()
  assert.equal(entryFile("E003"), undefined)
  await page.getByRole("button", { name: "Undo" }).click()
  await page.waitForURL(/entry=E003/)
  await e3.waitFor()
  assert.ok(existsSync(path.join(entriesDir, "E003-the-sse-bus-drops-events-on-project-swit.md")))
  await e3.getByRole("button", { name: "Delete" }).click()
  await page.getByText("Deleted E003").waitFor()
  assert.doesNotMatch(await mcp("vibedoc_read_memory", {}), /E003/)
  console.log("ok  delete → Undo → delete again → next session no longer lists it")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
