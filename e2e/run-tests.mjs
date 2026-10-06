// Browser check for R061 (Run tests from VibeDoc), end to end on a fixture project:
//   1. /manual-tests → Run tests on T001 → the steps stream in and the first 🤖 item ticks while the run still goes
//   2. It passes → the task file reads `Auto: passed <today>` with both 🤖 items [x] (the manual one untouched),
//      and the Evidence view lists the new run as newest
//   3. A second Run, stopped mid-step → Stopped, the task file is byte-identical, no half-written run folder
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/run-tests.mjs
//
// No real frontend to install: the fixture's Settings override points its app at VibeDoc's own server (only so
// the reachability probe answers; the spec renders its page with setContent) and its node_modules links to
// VibeDoc's, which has @playwright/test. Runs land in ~/.vibedoc/runs/<fixture key> and are removed in `finally`.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const key = path.basename(fx).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const runsDir = path.join(process.env.VIBEDOC_RUNS_DIR || path.join(os.homedir(), ".vibedoc", "runs"), key, "T001")
const taskFile = path.join(fx, "plans/tasks/T001-run.md")

writeFileSync(path.join(fx, "package.json"), JSON.stringify({ name: "run-fixture", private: true }))
symlinkSync(path.join(process.cwd(), "node_modules"), path.join(fx, "node_modules"))
mkdirSync(path.join(fx, ".vibedoc"), { recursive: true })
writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ frontend: { dir: ".", startCommand: "true", url: BASE } }))
mkdirSync(path.join(fx, "e2e/vibedoc"), { recursive: true })
// Step 2 waits on the page (not a sleep in the spec): long enough to see step 1 ticked live, and to Stop mid-step.
// Honest under R063: step 1 opens VibeDoc's /board (fails on the blank-page check), step 2 asserts on that page
writeFileSync(path.join(fx, "e2e/vibedoc/T001-run.spec.ts"), `
import { test, expect } from './kit/testing/playwright-fixture'
test.use({ vibedocTask: 'T001', baseURL: '${BASE}' })
test('T001', async ({ page, step }) => {
  await step('Open the page → heading shows', async () => {
    await page.goto('/board')
    await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible()
  })
  await step('Click Go → it reads Done', async () => {
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<button id="go" style="position:fixed;top:8px;left:50%;z-index:99999" onclick="setTimeout(() => this.textContent = \\'Done\\', 3000)">Go</button>'))
    await page.getByRole('button', { name: 'Go', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible({ timeout: 10000 })
  })
})
`)
writeFileSync(taskFile, [
  "# T001: Run me", "**Status:** 🔨 In-progress", "**Phase:** R002 — Epic", "**Depends on:** —", "",
  "## Manual tests", "_2026-10-05 — ai · Spec: `e2e/vibedoc/T001-run.spec.ts`_", "### Steps",
  "- [ ] 🤖 Open the page → heading shows", "- [ ] 🤖 Click Go → it reads Done", "- [ ] The button looks right", "",
].join("\n"))

const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` })()
const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  await page.goto(`${BASE}/manual-tests?tab=all&task=T001`)
  const runButton = page.getByRole("button", { name: "Run tests", exact: true })
  const live = page.getByRole("region", { name: "Live run" })
  const headline = () => live.locator("p").first().innerText().catch(() => "")
  const checklist = page.getByRole("region", { name: "Checklist" })

  // 1. Live: step 1 ticks while step 2 still runs
  await runButton.click()
  await live.waitFor()
  await checklist.getByLabel("Passed in this run").first().waitFor({ timeout: 30000 })
  assert.match(await headline(), /Running/, "step 1 ticked while the run still goes")
  await checklist.getByLabel("Running now").waitFor()
  console.log("ok  Run tests → steps stream in, the first 🤖 item ticks while step 2 runs")

  // 2. Verdict written to the task file, evidence has the run
  await live.getByText(/^Passed · 2\/2 steps/).waitFor({ timeout: 60000 })
  for (let i = 0; i < 50 && !readFileSync(taskFile, "utf8").includes(`Auto: passed ${today}`); i++) await page.waitForTimeout(100)
  const after = readFileSync(taskFile, "utf8")
  assert.match(after, new RegExp(`Spec: \`e2e/vibedoc/T001-run.spec.ts\` · Auto: passed ${today}_`))
  assert.match(after, /- \[x\] 🤖 Open the page → heading shows\n- \[x\] 🤖 Click Go → it reads Done\n- \[ \] The button looks right/)
  assert.ok(existsSync(path.join(fx, "e2e/vibedoc/kit/VERSION")), "the Run wrote the test kit")
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "evidence" }).click()
  const evidence = page.getByRole("region", { name: "Evidence" })
  await evidence.getByText(/✅ Passed/).first().waitFor()
  await evidence.locator("[data-zoom] img").first().waitFor()
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "review" }).click()
  console.log("ok  passed → Auto: passed + both 🤖 items [x] in the file; Evidence shows the new run")
  // R079: a single Run records in presentation mode (VibeDoc's own Playwright is 1.59+)
  const newest = readdirSync(runsDir).filter((d) => /^\d{8}T\d{6}Z$/.test(d)).sort().at(-1)
  assert.deepEqual(JSON.parse(readFileSync(path.join(runsDir, newest, "run.json"), "utf8")).presentation, { on: true, reason: null })

  // 3. Stop mid-step: nothing written, no half-written run folder
  const before = readFileSync(taskFile, "utf8")
  const kept = readdirSync(runsDir).filter((d) => /^\d{8}T\d{6}Z$/.test(d)).length
  await runButton.click()
  await checklist.getByLabel("Running now").waitFor({ timeout: 30000 })
  await page.waitForFunction(() => /step 2/.test(document.querySelector('[aria-label="Live run"] p')?.textContent ?? ""), null, { timeout: 30000 })
  await page.getByRole("button", { name: "Stop", exact: true }).first().click()
  await live.getByText("Stopped").waitFor({ timeout: 15000 })
  await page.waitForTimeout(1500) // the cancelled run's folder is removed after the process exits
  assert.equal(readFileSync(taskFile, "utf8"), before, "a stopped run writes nothing")
  assert.equal(readdirSync(runsDir).filter((d) => /^\d{8}T\d{6}Z$/.test(d)).length, kept, "no half-written run folder")
  console.log("ok  Stop mid-step → Stopped, task file unchanged, no leftover run folder")

  assert.deepEqual(errors, [], "browser console errors")
} finally {
  await browser.close()
  const left = (() => { try { return execFileSync("pgrep", ["-f", fx], { encoding: "utf8" }).trim() } catch { return "" } })()
  rmSync(path.dirname(runsDir), { recursive: true, force: true })
  rmSync(fx, { recursive: true, force: true })
  assert.equal(left, "", "no Playwright process left behind")
}
