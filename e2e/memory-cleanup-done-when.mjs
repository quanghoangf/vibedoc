// End-to-end check for R051's Done-when (T122), on one fixture project:
//   "a handoff that names a finished task as in progress shows a warning, and approving a suggested merge leaves one entry".
//   1. MEMORY.md lists done T001 under "Working on now" → vibedoc_read_memory has the "## ⚠ Memory warnings" block.
//   2. /memory → Cleanup shows that contradiction and the E001+E002 duplicate group.
//   3. Merge… → Merge into E001 → one entry file remains; reopened, Cleanup has the warning but no duplicate row.
//   4. Undo → both entry files are back byte-for-byte and Cleanup lists the duplicate again.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/memory-cleanup-done-when.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
writeFileSync(path.join(fx, "plans/tasks/T001-finished-thing.md"), "# T001: Finished thing\n**Status:** ✅ Done\n**Size:** S\n\n## Goal\nx\n")
const dir = path.join(fx, "memory/entries")
mkdirSync(dir, { recursive: true })
writeFileSync(path.join(fx, "memory/MEMORY.md"), "# Project Memory\n\n## Working on now\n- T001 finished thing\n\n## Handoff for next session\nKeep going.\n")
const files = {
  "E001-only-core-ts-touches-the-file-system.md": "# E001: Only core.ts touches the file system\n**Type:** convention\n**Updated:** 2026-09-01\n\nAPI routes import from core.\n",
  "E002-only-core-ts-may-touch-fs.md": "# E002: Only core.ts may touch fs\n**Type:** convention\n**Updated:** 2026-09-02\n\nNever import fs elsewhere.\n",
}
for (const [f, raw] of Object.entries(files)) writeFileSync(path.join(dir, f), raw)
const snapshot = () => Object.fromEntries(readdirSync(dir).sort().map((f) => [f, readFileSync(path.join(dir, f), "utf8")]))
const original = snapshot()
const WARNING = "Handoff says T001 is in progress, but it is done"

async function readMemory() {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_read_memory", arguments: {} } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

// 1. The session-start warning block
assert.match(await readMemory(), new RegExp(`## ⚠ Memory warnings\\n- ⚠ ${WARNING}`))
console.log("ok  vibedoc_read_memory shows the warning block for done T001 under Working on")

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
  const contradiction = panel.locator('[data-flag="contradiction:working-on:T001"]')
  const duplicate = panel.locator('[data-flag="duplicate:E001+E002"]')

  // 2. Cleanup lists both flags
  await page.goto(`${BASE}/memory`)
  await page.getByRole("button", { name: /^Cleanup \(\d+\)$/ }).click()
  await page.waitForURL(/cleanup=1/)
  await contradiction.getByText(WARNING).waitFor()
  await duplicate.getByText(/E001 and E002 look like duplicates/).waitFor()
  console.log("ok  Cleanup shows the contradiction and the duplicate group")

  // 3. Approve the suggested merge → one entry file
  await duplicate.getByRole("button", { name: "Merge…" }).click()
  const dialog = page.getByRole("dialog", { name: "Merge entries" })
  await dialog.waitFor()
  await dialog.getByRole("button", { name: "Merge into E001" }).click()
  await page.getByText("Merged into E001").waitFor()
  const merged = Object.keys(snapshot())
  assert.equal(merged.length, 1, `one entry file left: ${merged}`)
  assert.match(merged[0], /^E001-/)
  // merge opens the kept entry (closes the panel); reopened, Cleanup holds only the warning
  await page.waitForURL(/entry=E001/)
  await page.getByRole("button", { name: "Cleanup (1)" }).click()
  await contradiction.getByText(WARNING).waitFor()
  assert.equal(await duplicate.count(), 0, "duplicate row gone")
  const session = await readMemory()
  assert.doesNotMatch(session, /E002/)
  assert.match(session, new RegExp(WARNING))
  console.log("ok  merge leaves one entry (E001), the duplicate row goes, the warning stays")

  // 4. Undo → both files back exactly, and the duplicate group with them
  const undone = page.waitForResponse((r) => r.url().includes("/api/memory/entries/merge/undo"))
  await page.getByRole("button", { name: "Undo" }).click()
  assert.ok((await undone).ok())
  assert.deepEqual(snapshot(), original)
  await page.getByRole("button", { name: "Cleanup (2)" }).click()
  await duplicate.waitFor()
  console.log("ok  Undo brings both entries back byte-for-byte, Cleanup lists the duplicate again")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
