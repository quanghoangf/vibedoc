// Browser check for T120 (R051 approve a merge), on a fixture project:
//   1. E004 + E011 say the same thing → Cleanup lists them; Merge… opens the dialog with E004 kept by default.
//   2. Edit summary + body → Merge into E004 → one E004-*.md with the edited text, E011 gone, E012's "E011" → "E004",
//      the duplicate flag is gone, the kept entry is open, and vibedoc_read_memory lists E004 but not E011.
//   3. Undo → all three files are back byte-for-byte (same names, same text).
//   4. Bad requests (unknown id, empty summary) → 400 and no file changes.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/memory-merge.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const dir = path.join(fx, "memory/entries")
mkdirSync(dir, { recursive: true })
writeFileSync(path.join(fx, "memory/MEMORY.md"), "# Project Memory\n\n## Handoff for next session\nKeep going.\n")
const files = {
  "E004-only-core-ts-touches-the-file-system.md": "# E004: Only core.ts touches the file system\n**Type:** convention\n**Updated:** 2026-09-01\n\nAPI routes import from core.\n",
  "E011-only-core-ts-touches-the-file-system-ever.md": "# E011: Only core.ts touches the file system, ever\n**Type:** convention\n**Updated:** 2026-09-02\n\nNever import fs elsewhere.\n",
  "E012-sse-bus-is-a-singleton.md": "# E012: The SSE bus is a singleton\n**Type:** gotcha\n**Updated:** 2026-09-02\n\nRelated: E011.\n",
}
for (const [f, raw] of Object.entries(files)) writeFileSync(path.join(dir, f), raw)
const snapshot = () => Object.fromEntries(readdirSync(dir).sort().map((f) => [f, readFileSync(path.join(dir, f), "utf8")]))
const original = snapshot()

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

// 4. Bad requests first: nothing may change
for (const body of [
  { keepId: "E004", dropIds: ["E099"], type: "convention", summary: "x" },
  { keepId: "E004", dropIds: ["E011"], type: "convention", summary: " " },
  { keepId: "E004", dropIds: ["E004"], type: "convention", summary: "x" },
]) {
  const res = await fetch(`${BASE}/api/memory/entries/merge${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  assert.equal(res.status, 400, JSON.stringify(body))
}
assert.deepEqual(snapshot(), original)
console.log("ok  unknown id / empty summary / keep in drops → 400, no file changes")

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
  const flag = panel.locator('[data-flag="duplicate:E004+E011"]')

  // 1. Merge… opens the dialog, oldest id kept, body = both bodies under ---
  await page.goto(`${BASE}/memory?cleanup=1`)
  await flag.getByRole("button", { name: "Merge…" }).click()
  const dialog = page.getByRole("dialog", { name: "Merge entries" })
  await dialog.waitFor()
  assert.ok(await dialog.getByRole("radio", { name: /E004/ }).isChecked())
  assert.equal(await dialog.getByLabel("Merged details (markdown)").inputValue(), "API routes import from core.\n\n---\n\nNever import fs elsewhere.")
  console.log("ok  Merge… opens the dialog keeping E004, bodies joined under ---")

  // 2. Edit + approve (keyboard: ⌘↵)
  await dialog.getByLabel("Merged summary (one line)").fill("Only core.ts touches the fs")
  await dialog.getByLabel("Merged details (markdown)").fill("API routes import from core; never import fs elsewhere.")
  await dialog.getByLabel("Merged details (markdown)").press("ControlOrMeta+Enter")
  await page.waitForURL(/entry=E004/)
  await page.getByText("Merged into E004").waitFor()
  await page.locator('section[aria-label="E004"]').getByText("Only core.ts touches the fs").waitFor()
  const merged = snapshot()
  assert.deepEqual(Object.keys(merged), ["E004-only-core-ts-touches-the-fs.md", "E012-sse-bus-is-a-singleton.md"])
  assert.match(merged["E004-only-core-ts-touches-the-fs.md"], /^# E004: Only core.ts touches the fs\n\*\*Type:\*\* convention\n[\s\S]*\nAPI routes import from core; never import fs elsewhere.\n$/)
  assert.equal(merged["E012-sse-bus-is-a-singleton.md"], files["E012-sse-bus-is-a-singleton.md"].replace("E011", "E004"))
  const session = await mcp("vibedoc_read_memory", {})
  assert.match(session, /E004 · convention · Only core.ts touches the fs/)
  assert.doesNotMatch(session, /E011/)
  const { flags } = await (await fetch(`${BASE}/api/memory/health${q}`)).json()
  assert.ok(!flags.some((f) => f.kind === "duplicate"), "duplicate flag gone")
  console.log("ok  approve → one E004 file with the edited text, E011 gone, E012 points at E004, session lists only E004")

  // 3. Undo restores everything exactly
  const undone = page.waitForResponse((r) => r.url().includes("/api/memory/entries/merge/undo"))
  await page.getByRole("button", { name: "Undo" }).click()
  assert.ok((await undone).ok())
  assert.deepEqual(snapshot(), original)
  console.log("ok  Undo restores all three files byte-for-byte")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
