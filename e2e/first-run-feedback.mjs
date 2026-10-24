// Browser check for R086 (first-run feedback) on fresh, empty fixture projects:
//   1. A new project shows the consent card once its agent has connected (never before, never on /start), and the card
//      lists exactly the requests that would be made (S1).
//   2. No thanks → the card is gone (also after a reload) and nothing goes to GoatCounter while an agent connects,
//      an epic lands on the roadmap and a task is done (S3).
//   3. Yes on a second project → `started` and agent connected are sent once, then first roadmap / first task done are
//      each sent once, in order, as they happen; the requests carry the step and nothing from the project (S2).
//   4. "Stuck? Tell us" (card + Help panel) is a new-issue URL with the version and last step, nothing from the project (S4).
//   5. Settings → Privacy on a declined project: on → `started`, then the next step (ones reached while off never); off → nothing (S5).
// GoatCounter is intercepted (never reached). Fails on any browser console error. Fixtures removed in `finally`.
//
//   BASE=http://localhost:3086 PW_DIR=<dir with node_modules/playwright> node e2e/first-run-feedback.mjs
// (this repo with pnpm: PW_DIR=$PWD/node_modules/.pnpm/playwright@<version>/node_modules)
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { launchChrome, registerProject, stubChat } from "./stub-chat.mjs"

const { version: VERSION } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

const BASE = process.env.BASE ?? "http://localhost:3000"
const STEPS = ["started", "agent-connected", "first-roadmap", "first-task-done"]

/** An empty project: no epic, no task, no activity, never asked. */
function emptyFixture() {
  const fx = mkdtempSync(path.join(tmpdir(), "vibedoc-e2e-firstrun-"))
  mkdirSync(path.join(fx, "plans/roadmap"), { recursive: true })
  mkdirSync(path.join(fx, "plans/tasks"), { recursive: true })
  writeFileSync(path.join(fx, "plans/roadmap/R001-now.md"), "# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n")
  // in the hub up front: S2/S5 connect the agent before the page opens, and /api/mcp writes nothing for a root outside it
  registerProject(fx)
  return fx
}

const api = (fx, p) => `${BASE}${p}${p.includes("?") ? "&" : "?"}root=${encodeURIComponent(fx)}`
const post = (fx, p, body) => fetch(api(fx, p), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

/** Walks the project through the three later steps, the way an agent and a user would (each one emits SSE). */
async function reachSteps(fx, hits, expectAfter) {
  const r = await post(fx, "/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_read_memory", arguments: {} } })
  assert.equal(r.status, 200)
  await expectAfter(1)
  assert.equal((await post(fx, "/api/roadmap/create", { title: "First epic", parent: "R001" })).status, 201)
  await expectAfter(2)
  writeFileSync(path.join(fx, "plans/tasks/T001-first.md"), "# T001: First\n**Status:** 📋 Todo\n\n## Goal\nOne.\n")
  assert.equal((await post(fx, "/api/tasks", { taskId: "T001", status: "done" })).status, 200)
  await expectAfter(3)
  return hits
}

/** The card waits for the first step after `started`: an agent's tool call. */
const connectAgent = async (fx) => {
  const r = await post(fx, "/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_read_memory", arguments: {} } })
  assert.equal(r.status, 200)
}

/**
 * Runs `action` (a goto / reload) and resolves once the card's GET /api/feedback has answered and rendered. Not
 * networkidle: the SSE stream (/api/events) keeps the network busy forever. Any send the answer triggers starts in
 * that same callback, so the GoatCounter route has seen it by then.
 */
async function feedbackSettled(page, action) {
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/feedback")
  await action()
  await answered
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

async function openProject(browser, fx) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errors = []
  // the app has no favicon (the other e2e skip it too); not this feature's concern
  page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
  const hits = []
  await page.route(/goatcounter\.com/, (route) => { hits.push(route.request().url()); return route.fulfill({ status: 204 }) })
  await stubChat(page, [], { root: fx })
  await feedbackSettled(page, () => page.goto(`${BASE}/board`))
  return { page, hits, errors }
}

/** S4: the link opens a prefilled new issue that names only the version, OS and step. */
async function checkStuck(link, fx, step) {
  const u = new URL(await link.getAttribute("href"))
  assert.equal(u.origin + u.pathname, "https://github.com/quanghoangf/vibedoc/issues/new")
  assert.equal(await link.getAttribute("target"), "_blank")
  const body = u.searchParams.get("body")
  assert.match(body, new RegExp(`VibeDoc ${VERSION.replace(/\./g, "\\.")} · .+ · last first-run step: ${step}$`))
  assert.ok(!u.href.includes(path.basename(fx)) && !body.includes(fx), "nothing from the project in the issue")
}

const until = async (fn, what) => {
  for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out waiting for ${what}`)
}

const fxNo = emptyFixture()
const fxYes = emptyFixture()
const fxSettings = emptyFixture()
const browser = await launchChrome()
try {
  // ── S1 + S3: no card before the agent connects; then the card, then No thanks ──
  {
    const { page, hits, errors } = await openProject(browser, fxNo)
    const card = page.getByRole("region", { name: "First-run feedback" })
    assert.equal(await card.count(), 0, "no card before an agent has connected")
    await connectAgent(fxNo) // SSE session_start → the card appears live
    await card.waitFor()
    await card.getByText("What exactly is sent?").click()
    for (const s of STEPS) {
      await card.getByText(`GET https://vibedoc.goatcounter.com/count?p=${encodeURIComponent(`/first-run/${s}`)}`, { exact: false }).waitFor()
    }
    await checkStuck(card.getByRole("link", { name: "Stuck? Tell us" }), fxNo, "agent-connected")
    await card.getByRole("button", { name: "No thanks" }).click()
    await card.waitFor({ state: "detached" })
    await feedbackSettled(page, () => page.reload())
    assert.equal(await card.count(), 0, "the card doesn't come back once answered")
    // Steps happen, nothing leaves
    await reachSteps(fxNo, hits, async () => { await new Promise((r) => setTimeout(r, 600)) })
    await feedbackSettled(page, () => page.reload())
    assert.deepEqual(hits, [], "opted out: no request to GoatCounter")
    // The Help panel's link reports the furthest step, consent or not
    await page.locator('[aria-keyshortcuts="?"]').first().click()
    await checkStuck(page.getByRole("region", { name: "Help" }).getByRole("link", { name: "Stuck? Tell us" }), fxNo, "first-task-done")
    assert.deepEqual(errors, [])
    await page.close()
  }

  // ── S2: Yes, then each step once, in order ────────────────────────────────────
  {
    await connectAgent(fxYes)
    const { page, hits, errors } = await openProject(browser, fxYes)
    const card = page.getByRole("region", { name: "First-run feedback" })
    await card.getByRole("button", { name: "Yes, send these" }).click()
    await card.waitFor({ state: "detached" })
    // the card asks once the agent connected, so a yes sends both (reachSteps' first wait is then already met)
    await until(() => hits.length === 2, "started + agent-connected")
    await reachSteps(fxYes, hits, (n) => until(() => hits.length === n + 1, STEPS[n]))
    // Reloads and later events send nothing again
    await feedbackSettled(page, () => page.reload())
    await post(fxYes, "/api/tasks", { taskId: "T001", status: "todo" })
    await post(fxYes, "/api/tasks", { taskId: "T001", status: "done" })
    await new Promise((r) => setTimeout(r, 800))
    const paths = hits.map((u) => new URL(u).searchParams.get("p"))
    assert.deepEqual(paths, STEPS.map((s) => `/first-run/${s}`), "each step once, in order")
    for (const u of hits) {
      assert.ok(!u.includes(path.basename(fxYes)) && !u.includes(encodeURIComponent(fxYes)), "no project path in the request")
      assert.deepEqual([...new URL(u).searchParams.keys()], ["p", "t", "e"])
    }
    assert.deepEqual(errors, [])
    await page.close()
  }
  // ── S5: Settings → Privacy ────────────────────────────────────────────────────
  {
    await connectAgent(fxSettings)
    const { page, hits, errors } = await openProject(browser, fxSettings)
    await page.getByRole("region", { name: "First-run feedback" }).getByRole("button", { name: "No thanks" }).click()
    await page.goto(`${BASE}/settings`)
    await page.getByRole("button", { name: "Privacy", exact: true }).first().click()
    const sw = page.getByRole("switch", { name: "First-run feedback" })
    assert.equal(await sw.getAttribute("aria-checked"), "false", "declined → off")
    await sw.click()
    await until(async () => (await sw.getAttribute("aria-checked")) === "true", "switch on")
    // On from here: `started` (like a yes on the card); agent-connected was reached while off, so it is never sent
    await until(() => hits.length === 1, "started on opt-in")
    await new Promise((r) => setTimeout(r, 800))
    assert.equal(hits.length, 1, "steps reached before turning it on are not sent")
    assert.equal((await post(fxSettings, "/api/roadmap/create", { title: "First epic", parent: "R001" })).status, 201)
    await until(() => hits.length === 2, "first-roadmap after turning it on")
    assert.deepEqual(hits.map((u) => new URL(u).searchParams.get("p")), ["/first-run/started", "/first-run/first-roadmap"])
    await sw.click()
    await until(async () => (await sw.getAttribute("aria-checked")) === "false", "switch off")
    writeFileSync(path.join(fxSettings, "plans/tasks/T001-first.md"), "# T001: First\n**Status:** 📋 Todo\n\n## Goal\nOne.\n")
    await post(fxSettings, "/api/tasks", { taskId: "T001", status: "done" })
    await new Promise((r) => setTimeout(r, 800))
    assert.equal(hits.length, 2, "off again: nothing more is sent")
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log("first-run-feedback: ok")
} finally {
  await browser.close()
  rmSync(fxNo, { recursive: true, force: true })
  rmSync(fxYes, { recursive: true, force: true })
  rmSync(fxSettings, { recursive: true, force: true })
}
