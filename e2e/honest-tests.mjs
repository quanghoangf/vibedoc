// Browser check for R063 (honest tests), end to end on a fixture project:
//   1. A kit spec with an honest step, a step with no expect and one with only `expect(true)` → Run tests on
//      /manual-tests → the strip shows the blank-page check, then "Passed · 3/3 steps · 2 unverified"
//   2. The task file: only the honest 🤖 item ticked, `Auto: passed <today> · 2 unverified`; the task (done)
//      still shows under Needs you
//   3. Moved to review, Evidence lists both weak steps as unverified and Send back writes them as ❔ marks
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/honest-tests.mjs
//
// Same setup as e2e/run-tests.mjs: the fixture's app is VibeDoc's own server (the honest step opens /board),
// node_modules links to VibeDoc's. Runs land in ~/.vibedoc/runs/<fixture key> and are removed in `finally`.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const key = path.basename(fx).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const runsDir = path.join(process.env.VIBEDOC_RUNS_DIR || path.join(os.homedir(), ".vibedoc", "runs"), key)
const taskFile = path.join(fx, "plans/tasks/T001-honest.md")

writeFileSync(path.join(fx, "package.json"), JSON.stringify({ name: "honest-fixture", private: true }))
symlinkSync(path.join(process.cwd(), "node_modules"), path.join(fx, "node_modules"))
mkdirSync(path.join(fx, ".vibedoc"), { recursive: true })
writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ frontend: { dir: ".", startCommand: "true", url: BASE } }))
mkdirSync(path.join(fx, "e2e/vibedoc"), { recursive: true })
writeFileSync(path.join(fx, "e2e/vibedoc/T001-honest.spec.ts"), `
import { test, expect } from './kit/testing/playwright-fixture'
test.use({ vibedocTask: 'T001', baseURL: '${BASE}' })
test('T001', async ({ page, step }) => {
  await step('Open /board → the Board heading shows', async () => {
    await page.goto('/board')
    await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible()
  })
  await step('Click nothing → nothing to see', async () => {
    await page.mouse.move(1, 1)
  })
  await step('Trust me → it works', async () => {
    expect(true).toBe(true)
  })
})
`)
writeFileSync(taskFile, [
  "# T001: Honest", "**Status:** ✅ Done", "**Phase:** R002 — Epic", "**Depends on:** —", "",
  "## Manual tests", "_2026-10-05 — ai · Spec: `e2e/vibedoc/T001-honest.spec.ts`_", "### Steps",
  "- [ ] 🤖 Open /board → the Board heading shows", "- [ ] 🤖 Click nothing → nothing to see", "- [ ] 🤖 Trust me → it works", "",
].join("\n"))

const mcp = async (name, args) => {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  return (await res.json()).result?.content?.[0]?.text ?? ""
}
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` })()
const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. Run → blank-page check → verdict with 2 unverified
  await page.goto(`${BASE}/manual-tests?tab=all&task=T001`)
  await page.getByRole("button", { name: "Run tests", exact: true }).click()
  const live = page.getByRole("region", { name: "Live run" })
  await live.getByText("Checking the test is honest…").waitFor({ timeout: 40000 })
  await live.getByText(/^Passed · 3\/3 steps/).waitFor({ timeout: 40000 })
  for (let i = 0; i < 50 && !readFileSync(taskFile, "utf8").includes("unverified_"); i++) await page.waitForTimeout(100)
  await live.getByText("Passed · 3/3 steps · 2 unverified").waitFor({ timeout: 10000 })
  console.log("ok  Run → \"Checking the test is honest…\" → Passed · 3/3 steps · 2 unverified")

  // 2. The file and triage
  const after = readFileSync(taskFile, "utf8")
  assert.match(after, new RegExp(`· Auto: passed ${today} · 2 unverified_`))
  assert.match(after, /- \[x\] 🤖 Open \/board → the Board heading shows\n- \[ \] 🤖 Click nothing → nothing to see\n- \[ \] 🤖 Trust me → it works/)
  const checklist = page.getByRole("region", { name: "Checklist" })
  await checklist.getByText("· 2 unverified, check by hand").waitFor()
  assert.equal(await checklist.getByText("unverified", { exact: true }).count(), 2)
  await page.goto(`${BASE}/manual-tests?task=T001`) // Needs you (the default tab) lists the done task
  await page.locator('[data-row="T001"]').waitFor()
  console.log("ok  file: only the honest item [x], Auto … · 2 unverified; the done task is under Needs you")

  // 3. Review from the proof: both weak steps flagged and sent back
  assert.match(await mcp("vibedoc_update_task", { taskId: "T001", status: "review" }), /→ \*\*review\*\*/)
  await page.goto(`${BASE}/manual-tests?tab=all&task=T001`)
  const ev = page.getByRole("region", { name: "Evidence" })
  const steps = ev.getByRole("list", { name: "Steps to review" })
  await steps.waitFor()
  assert.equal(await steps.getByText("unverified", { exact: true }).count(), 2)
  await ev.getByText("2 unverified").first().waitFor()
  await ev.getByRole("button", { name: "Send back…" }).click()
  await ev.getByRole("button", { name: "Send back", exact: true }).click()
  for (let i = 0; i < 50 && !readFileSync(taskFile, "utf8").includes("changes requested"); i++) await page.waitForTimeout(100)
  const sent = readFileSync(taskFile, "utf8")
  assert.match(sent, /- ❔ Step 2 "Click nothing → nothing to see" — unverified: no assertion/)
  assert.match(sent, /- ❔ Step 3 "Trust me → it works" — unverified: only trivial assertions/)
  console.log("ok  review: Evidence flags both, Send back writes them as ❔ unverified marks")

  assert.deepEqual(errors, [], "browser console errors")
} finally {
  await browser.close()
  const left = (() => { try { return execFileSync("pgrep", ["-f", fx], { encoding: "utf8" }).trim() } catch { return "" } })()
  rmSync(runsDir, { recursive: true, force: true })
  rmSync(fx, { recursive: true, force: true })
  assert.equal(left, "", "no Playwright process left behind")
}
