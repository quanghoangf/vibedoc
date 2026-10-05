// Browser check for R065 (self-fixing failures & flaky tests), end to end on a fixture project
// (tests.retries 1, tests.maxAutoFixes 2):
//   1. Suite with T001 (a deliberately broken step) and T002 (fails on its first attempt, passes on the retry) →
//      "Failed · 1 of 2 tasks broke · 1 flaky": T001 is back in todo with an (auto) entry whose ❌ mark names a
//      screenshot that exists; T002 stays done, flaky in the Suite tab and in its header.
//   2. A single Run of T002 with a fresh first attempt → "· 1 flaky", still done.
//   3. The cap: T001 reported done (→ review, a check is left) → Run → todo (attempt 2), again → Run → review with
//      "auto fix limit reached".
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/self-fixing.mjs
//
// Same setup as e2e/run-tests.mjs (the fixture's app is VibeDoc's own server). Runs land in
// ~/.vibedoc/runs/<fixture key> and are removed in `finally`.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const key = path.basename(fx).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const runsDir = path.join(process.env.VIBEDOC_RUNS_DIR || path.join(os.homedir(), ".vibedoc", "runs"), key)
const counter = path.join(fx, "first-attempt-done")
const file = (id) => path.join(fx, `plans/tasks/${id}-x.md`)

writeFileSync(path.join(fx, "package.json"), JSON.stringify({ name: "self-fix-fixture", private: true }))
symlinkSync(path.join(process.cwd(), "node_modules"), path.join(fx, "node_modules"))
mkdirSync(path.join(fx, ".vibedoc"), { recursive: true })
writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ frontend: { dir: ".", startCommand: "true", url: BASE }, tests: { retries: 1, maxAutoFixes: 2 } }))
mkdirSync(path.join(fx, "e2e/vibedoc"), { recursive: true })
const OPEN = "Open /board → the Board heading shows"
const BROKEN = "Open /board → it says Nope"
const FLAKY = "Open /board → the New task button shows"
writeFileSync(path.join(fx, "e2e/vibedoc/T001.spec.ts"), `
import { test, expect } from './kit/testing/playwright-fixture'
test.use({ baseURL: '${BASE}' })
test('T001', async ({ page, step }) => {
  await step('${OPEN}', async () => { await page.goto('/board'); await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible() })
  await step('${BROKEN}', async () => { await expect(page.getByRole('heading', { name: 'Nope' })).toBeVisible({ timeout: 1000 }) })
})
`)
writeFileSync(path.join(fx, "e2e/vibedoc/T002.spec.ts"), `
import { test, expect } from './kit/testing/playwright-fixture'
import { existsSync, writeFileSync } from 'fs'
test.use({ baseURL: '${BASE}' })
test('T002', async ({ page, step }) => {
  await step('${FLAKY}', async () => {
    await page.goto('/board')
    const first = !existsSync(${JSON.stringify(counter)})
    writeFileSync(${JSON.stringify(counter)}, 'x')
    await expect(page.getByRole('button', { name: first ? 'Not there' : /New task/ })).toBeVisible({ timeout: 1500 })
  })
})
`)
const task = (id, steps) => writeFileSync(file(id), [
  `# ${id}: Task ${id}`, "**Status:** ✅ Done", "**Phase:** R002 — Epic", "**Depends on:** —", "",
  "## Manual tests", `_2026-10-05 — ai · Spec: \`e2e/vibedoc/${id}.spec.ts\`_`, "### Steps", ...steps.map((s) => `- [x] 🤖 ${s}`), "",
].join("\n"))
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001, T002\n")
task("T001", [OPEN, BROKEN])
task("T002", [FLAKY])

const mcp = async (name, args) => {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  return (await res.json()).result?.content?.[0]?.text ?? ""
}
const status = (id) => readFileSync(file(id), "utf8").match(/\*\*Status:\*\* (.+)/)[1]
const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  const waitFor = async (cond, what) => { for (let i = 0; i < 100 && !cond(); i++) await page.waitForTimeout(100); assert.ok(cond(), what) }

  // 1. Suite: T001 broken → back to the agent with its screenshot; T002 flaky → stays done, labelled
  await page.goto(`${BASE}/manual-tests?tab=suite`)
  await page.getByRole("button", { name: "Run suite" }).click()
  await page.getByText("Failed · 1 of 2 tasks broke · 1 flaky").waitFor({ timeout: 120000 })
  await page.getByText(/passed \(1 flaky\)/).click()
  await page.getByRole("list", { name: "Passed tasks" }).getByText("flaky", { exact: true }).waitFor()
  await waitFor(() => status("T001").includes("Todo"), "T001 sent back to todo")
  const t1 = readFileSync(file("T001"), "utf8")
  assert.match(t1, /— changes requested \(auto\)\nRun (\d{8}T\d{6}Z)\n- ❌ Step 2 "Open \/board → it says Nope" — failed: .+ · screenshot (\S+\.png)/)
  const [, runId, shot] = t1.match(/Run (\d{8}T\d{6}Z)\n- ❌ Step 2 .+ · screenshot (\S+\.png)/)
  assert.ok(existsSync(path.join(runsDir, "T001", runId, shot)), "the failed mark's screenshot exists")
  assert.ok(status("T002").includes("Done"), "flaky T002 stays done")
  assert.match(readFileSync(file("T002"), "utf8"), /· Auto: passed \d{4}-\d{2}-\d{2} · 1 flaky_/)
  console.log("ok  suite: broken T001 → todo with ❌ Step 2 + its screenshot; flaky T002 stays done, labelled flaky")

  // 2. A single Run of T002 whose first attempt fails again → flaky, still done
  rmSync(counter, { force: true })
  await page.goto(`${BASE}/manual-tests?tab=all&task=T002`)
  await page.getByRole("button", { name: "Run tests", exact: true }).click()
  await page.getByRole("region", { name: "Live run" }).getByText(/^Passed · 1\/1 steps.* · 1 flaky/).waitFor({ timeout: 90000 })
  assert.ok(status("T002").includes("Done"))
  console.log("ok  single Run: T002 passes on the retry → Passed · 1 flaky, still done")

  // 3. The cap (2): T001 was sent back once; done → Run → todo (attempt 2); done → Run → review, limit reached
  const runT001 = async () => {
    await page.goto(`${BASE}/manual-tests?tab=all&task=T001`)
    await page.getByRole("button", { name: "Run tests", exact: true }).click()
    await page.getByRole("region", { name: "Live run" }).getByText(/^Failed at step 2/).waitFor({ timeout: 90000 })
  }
  // The agent reports done, but its failed 🤖 item is still unticked, so it lands in review (a Run works from there)
  assert.match(await mcp("vibedoc_update_task", { taskId: "T001", status: "done" }), /→ \*\*review\*\*/)
  await runT001()
  await waitFor(() => status("T001").includes("Todo"), "attempt 2 → todo")
  assert.match(await mcp("vibedoc_next_task", { epic: "R002" }), /Auto-fix attempt 2 of 2/)
  assert.match(await mcp("vibedoc_update_task", { taskId: "T001", status: "done" }), /→ \*\*review\*\*/)
  await runT001()
  await waitFor(() => readFileSync(file("T001"), "utf8").includes("auto fix limit reached"), "limit → review")
  assert.ok(status("T001").includes("Review"))
  assert.match(readFileSync(file("T001"), "utf8"), /— auto fix limit reached \(2 attempts\)/)
  assert.match(await mcp("vibedoc_next_task", { epic: "R002" }), /T001 in review — needs a human/)
  console.log("ok  cap: attempt 2 → todo, then review with \"auto fix limit reached (2 attempts)\", not handed out")

  assert.deepEqual(errors, [], "browser console errors")
} finally {
  await browser.close()
  const left = (() => { try { return execFileSync("pgrep", ["-f", fx], { encoding: "utf8" }).trim() } catch { return "" } })()
  rmSync(runsDir, { recursive: true, force: true })
  rmSync(fx, { recursive: true, force: true })
  assert.equal(left, "", "no Playwright process left behind")
}
