// Browser check for R064 (regression suite), end to end on a fixture project:
//   1. Two done tasks, each with an honest kit spec → /manual-tests?tab=suite → Run suite → "Passed · 2/2 tasks"
//   2. Break one task's feature check (its spec now expects something the app doesn't show) → Run suite again →
//      "Failed · 1 of 2 tasks broke": that task is listed first with its failing step and a loaded screenshot,
//      the other still passes, and Open evidence lands on the same failure. (R064's Done when.)
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/regression-suite.mjs
//
// Same setup as e2e/run-tests.mjs: the fixture's app is VibeDoc's own server (the specs open its /board),
// node_modules links to VibeDoc's. Runs land in ~/.vibedoc/runs/<fixture key> and are removed in `finally`.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const key = path.basename(fx).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const runsDir = path.join(process.env.VIBEDOC_RUNS_DIR || path.join(os.homedir(), ".vibedoc", "runs"), key)

writeFileSync(path.join(fx, "package.json"), JSON.stringify({ name: "suite-fixture", private: true }))
symlinkSync(path.join(process.cwd(), "node_modules"), path.join(fx, "node_modules"))
mkdirSync(path.join(fx, ".vibedoc"), { recursive: true })
writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ frontend: { dir: ".", startCommand: "true", url: BASE } }))
mkdirSync(path.join(fx, "e2e/vibedoc"), { recursive: true })
const spec = (id, step, check) => writeFileSync(path.join(fx, `e2e/vibedoc/${id}.spec.ts`), `
import { test, expect } from './kit/testing/playwright-fixture'
test.use({ baseURL: '${BASE}' })
test('${id}', async ({ page, step }) => {
  await step('${step}', async () => {
    await page.goto('/board')
    ${check}
  })
})
`)
const task = (id, title, step) => writeFileSync(path.join(fx, `plans/tasks/${id}-x.md`), [
  `# ${id}: ${title}`, "**Status:** ✅ Done", "**Phase:** R002 — Epic", "**Depends on:** —", "",
  "## Manual tests", `_2026-10-05 — ai · Spec: \`e2e/vibedoc/${id}.spec.ts\`_`, "### Steps", `- [x] 🤖 ${step}`, "",
].join("\n"))
const STEP1 = "Open /board → the Board heading shows"
const STEP2 = "Open /board → the New task button shows"
task("T001", "Board heading", STEP1)
task("T002", "New task button", STEP2)
spec("T001", STEP1, "await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible()")
spec("T002", STEP2, "await expect(page.getByRole('button', { name: /New task/ })).toBeVisible()")

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. Both pass
  await page.goto(`${BASE}/manual-tests?tab=suite`)
  await page.getByText("2 specs from done tasks").waitFor()
  await page.getByRole("button", { name: "Run suite" }).click()
  await page.getByText("Passed · 2/2 tasks").waitFor({ timeout: 90000 })
  console.log("ok  Run suite → Passed · 2/2 tasks")
  // R079: the suite records plain
  for (const t of ["T001", "T002"]) {
    const dir = path.join(runsDir, t)
    const newest = readdirSync(dir).filter((d) => /^\d{8}T\d{6}Z$/.test(d)).sort().at(-1)
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, newest, "run.json"), "utf8")).presentation, { on: false, reason: "suite" })
  }

  // 2. Break T002's feature check → the suite names T002 with its failing step and screenshot
  spec("T002", STEP2, "await expect(page.getByRole('button', { name: 'Nope, gone' })).toBeVisible({ timeout: 1500 })")
  await page.getByRole("button", { name: "Run suite" }).click()
  await page.getByText("Failed · 1 of 2 tasks broke").waitFor({ timeout: 90000 })
  const broken = page.getByRole("region", { name: "Broken tasks" })
  assert.equal(await broken.getByRole("article").count(), 1)
  await broken.getByText("T002", { exact: true }).waitFor()
  await broken.getByText(STEP2).waitFor()
  const shot = broken.getByRole("img")
  await shot.waitFor({ timeout: 10000 })
  for (let i = 0; i < 50 && !(await shot.evaluate((el) => el.complete && el.naturalWidth > 0)); i++) await page.waitForTimeout(100)
  assert.ok(await shot.evaluate((el) => el.naturalWidth > 0), "failing step's screenshot loaded")
  await page.getByText("1 passed").click()
  await page.getByRole("list", { name: "Passed tasks" }).getByText("T001", { exact: true }).waitFor()
  console.log("ok  broken T002 → Failed · 1 of 2 tasks broke, T002 first with its step and screenshot, T001 passed")

  await broken.getByRole("link", { name: "Open evidence" }).click()
  await page.waitForURL(/task=T002&view=evidence/)
  await page.getByRole("region", { name: "Evidence" }).locator(".prose-dark").getByText(/Nope, gone/).first().waitFor()
  console.log("ok  Open evidence → T002's Evidence shows the same failure")

  assert.deepEqual(errors, [], "browser console errors")
} finally {
  await browser.close()
  const left = (() => { try { return execFileSync("pgrep", ["-f", fx], { encoding: "utf8" }).trim() } catch { return "" } })()
  rmSync(runsDir, { recursive: true, force: true })
  rmSync(fx, { recursive: true, force: true })
  assert.equal(left, "", "no Playwright process left behind")
}
