// Browser check for R060 (evidence report per task), end to end on a fixture project:
//   1. Two capture-demo runs (one failing) for fixture task T001 → EVIDENCE.md next to the runs, matching its 🤖 items
//   2. Board: click T001's 🧪 badge → /manual-tests Evidence view, each step's screenshot loaded, the failed step's
//      error shown; pick the older run in History → it is detailed
//   3. Task panel → Evidence → the same view
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/evidence.mjs
//
// The server reads runs from ~/.vibedoc/runs (or $VIBEDOC_RUNS_DIR of the server), so the runs are written there
// under the fixture's project key and removed in `finally`, with the fixture.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const key = path.basename(fx).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const runsDir = path.join(process.env.VIBEDOC_RUNS_DIR || path.join(os.homedir(), ".vibedoc", "runs"), key)
writeFileSync(path.join(fx, "plans/tasks/T001-capture.md"), [
  "# T001: Capture demo", "**Status:** 👀 Review", "**Phase:** R002 — Epic", "**Depends on:** —", "",
  "## Manual tests", "_2026-10-04 — ai · Spec: `e2e/fixtures/capture-demo.spec.ts`_", "### Steps",
  "- [ ] 🤖 Open the page → heading shows", "- [ ] 🤖 Click the button → it reads Clicked", "- [ ] The page looks right", "",
].join("\n"))

const demo = (fail) => {
  try {
    execFileSync("npx", ["playwright", "test", "e2e/fixtures/capture-demo.spec.ts"], {
      env: { ...process.env, VIBEDOC_PROJECT: fx, VIBEDOC_TASK_ID: "T001", ...(fail ? { CAPTURE_DEMO_FAIL: "1" } : {}) }, stdio: "ignore",
    })
  } catch { assert.ok(fail, "the passing demo run failed") }
}

const browser = await launchChrome()
const errors = []
try {
  demo(false)
  execFileSync("sleep", ["1"]) // distinct runIds
  demo(true)
  const doc = readFileSync(path.join(runsDir, "T001", "EVIDENCE.md"), "utf8")
  assert.match(doc, /^# T001 — Capture demo: evidence/)
  assert.match(doc, /\*\*❌ \[Failed at step 2/)
  assert.match(doc, /1\/2 steps passed/)
  assert.match(doc, /- ✅ Open the page → heading shows\n {2}!\[[^\]]+\]\(\d{8}T\d{6}Z\/01-[\w-]+\.png\)/)
  assert.match(doc, /- ☐ The page looks right — _manual, not ticked yet_/)
  assert.equal(doc.match(/^\| \d{4}-/gm)?.length, 2, "two runs in History")
  console.log("ok  two runs → EVIDENCE.md with the 🤖 items matched and both runs in History")

  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  const evidence = page.getByRole("region", { name: "Evidence" })
  // The doc's screenshots only (a task in review also has the review steps' icons and thumbnails above it)
  const shots = evidence.locator(".prose-dark [data-zoom] img")
  const loaded = async () => {
    await shots.first().waitFor()
    for (const img of await shots.all()) {
      for (let i = 0; i < 50 && !(await img.evaluate((el) => el.complete && el.naturalWidth > 0)); i++) await page.waitForTimeout(100)
      assert.ok(await img.evaluate((el) => el.naturalWidth > 0), "screenshot loaded")
    }
  }

  await page.goto(`${BASE}/board`)
  const card = page.getByRole("button", { name: /T001 Capture demo/ })
  await card.getByText("Capture demo").click()   // the card body still opens the panel
  await page.getByRole("dialog").waitFor()
  await page.keyboard.press("Escape")
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  await card.getByTitle(/^Manual tests:/).focus()  // Enter on the 🧪 badge follows it, not the card's Enter
  await page.keyboard.press("Enter")
  await page.waitForURL(/\/manual-tests\?tab=all&task=T001&view=evidence/)
  assert.equal(await page.getByRole("dialog").count(), 0)
  await loaded()
  assert.equal(await shots.count(), 2)
  await evidence.locator(".prose-dark").getByText('Received: "Clicked"').waitFor()
  const history = page.getByRole("navigation", { name: "History" })
  await history.getByRole("button").nth(1).click()
  await page.waitForURL(/run=\d{8}T\d{6}Z/)
  await evidence.locator(".prose-dark").getByText("2/2 steps").waitFor()
  await loaded()
  console.log("ok  card body → panel; 🧪 badge (Enter) → Evidence view: screenshots loaded, failure shown, older run picked from History")

  await page.goto(`${BASE}/board?task=T001`)
  await page.getByRole("dialog").getByRole("link", { name: "Evidence →", exact: true }).click()
  await page.waitForURL(/view=evidence/)
  await loaded()
  console.log("ok  task panel → Evidence → same view")

  assert.deepEqual(errors, [], "browser console errors")
} finally {
  await browser.close()
  rmSync(runsDir, { recursive: true, force: true })
  rmSync(fx, { recursive: true, force: true })
  assert.ok(!existsSync(runsDir))
}
