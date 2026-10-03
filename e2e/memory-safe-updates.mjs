// Browser check for T127 (R045 safe memory updates), on a fixture project:
//   1. MEMORY.md has a hand-written "## Key conventions" section. vibedoc_update_memory {handoff} through /api/mcp
//      → /memory shows the new handoff and the conventions section is byte-identical.
//   2. History lists the earlier version; Restore → the old handoff is back; Undo → the new one is back.
//   3. vibedoc_memory_history lists the versions and reads one; restore through MCP updates the open page live (SSE).
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/memory-safe-updates.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const file = path.join(fx, "memory/MEMORY.md")
const conventions = "## Key conventions\n- Hand-written rule: only core.ts touches fs\n- Keep this line exactly\n\n"
mkdirSync(path.join(fx, "memory"), { recursive: true })
writeFileSync(file, `# Project Memory\n**Last updated:** 2026-09-01\n\n${conventions}## Handoff for next session\nOld handoff from last week.\n`)
const read = () => readFileSync(file, "utf8")

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
  const handoff = page.getByRole("heading", { name: "Session handoff" }).locator("xpath=../..")

  // 1. Partial update keeps the hand-written section
  assert.match(await mcp("vibedoc_update_memory", { handoff: "New handoff: ship R045." }), /MEMORY\.md updated/)
  assert.ok(read().includes(conventions), "Key conventions section is byte-identical")
  assert.match(read(), /## Handoff for next session\nNew handoff: ship R045\.\n/)
  assert.doesNotMatch(read(), /Old handoff/)
  await page.goto(`${BASE}/memory`)
  await handoff.getByText("New handoff: ship R045.").waitFor()
  await handoff.getByText("Hand-written rule: only core.ts touches fs").waitFor()
  console.log("ok  vibedoc_update_memory {handoff} rewrites only the handoff; Key conventions untouched and shown")

  // 2. History → Restore → Undo
  await page.getByRole("button", { name: "History (1)" }).click()
  const pane = page.locator('section[aria-label="MEMORY.md history"]')
  await pane.getByRole("button", { name: /Old handoff from last week\./ }).click()
  await page.waitForURL(/version=/)
  await pane.getByText("Old handoff from last week.").last().waitFor() // the + line in the diff
  await pane.getByRole("button", { name: "Restore this version" }).click()
  await pane.waitFor({ state: "detached" }) // back to the rendered handoff
  await handoff.getByText("Old handoff from last week.").waitFor()
  assert.match(read(), /Old handoff from last week\./)
  assert.ok(read().includes(conventions))
  await page.getByRole("button", { name: "History (2)" }).waitFor()
  console.log("ok  History lists the earlier version; Restore brings the old handoff back")

  await page.getByRole("button", { name: "Undo" }).click()
  await handoff.getByText("New handoff: ship R045.").waitFor()
  assert.match(read(), /New handoff: ship R045\./)
  assert.ok(read().includes(conventions))
  await page.getByRole("button", { name: "History (3)" }).waitFor()
  console.log("ok  Undo brings the new handoff back")

  // 3. MCP history: list, read, restore → the open page updates live
  const list = await mcp("vibedoc_memory_history", {})
  const lines = list.split("\n")
  assert.equal(lines.length, 3, list)
  for (const l of lines) assert.match(l, /^\d{8}T\d{9}Z-\w+ · \d{4}-\d\d-\d\dT[\d:.]+Z · (ai|human) · (update|restore) · /)
  const old = lines.find((l) => l.endsWith("Old handoff from last week."))
  assert.ok(old, list)
  const id = old.split(" · ")[0]
  assert.match(await mcp("vibedoc_memory_history", { id }), /Old handoff from last week\./)
  assert.equal(read().includes("Old handoff"), false, "reading a version does not restore it")
  assert.match(await mcp("vibedoc_memory_history", { id: "20000101T000000000Z-ai" }), /not found/)
  assert.match(await mcp("vibedoc_memory_history", { id, restore: true }), /^Restored MEMORY\.md to .+; the replaced version is \d{8}T\d{9}Z-ai$/)
  await handoff.getByText("Old handoff from last week.").waitFor({ timeout: 5000 }) // no reload: SSE
  await page.getByRole("button", { name: "History (4)" }).waitFor()
  assert.ok(read().includes(conventions))
  console.log("ok  vibedoc_memory_history lists/reads versions; an MCP restore updates the open page live")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
